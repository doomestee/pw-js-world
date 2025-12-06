import Block from "./Block.js";
import type { LayerType } from "./Constants.js";
import type PWGameWorldHelper from "./Helper.js";
import type { BlockArg, Point, SendableBlockPacket } from "./types";
import { createBlockPackets } from "./util/Misc.js";

/**
 * This is external to the main Helper, it will allow developers to use the structure without needing to use helper if they so wish.
 * 
 * All of the functions are static!
 */
export default class StructureHelper {
    /**
     * NOTE: If you're reading a file, you must get it then pass it to read.
     * 
     * This is for reading the structure itself, if you have just the blocks (and width/height), you must use deserialiseStructBlocks;
     * 
     * @param data Buffer representing the JSON structure itself.
     */
    static read(data: Buffer | Uint8Array | IStructure) {
        if (data instanceof Uint8Array) {
            const decoder = new TextDecoder();
            data = JSON.parse(decoder.decode(data));
        }

        const json = "version" in data ? data : JSON.parse(data.toString()) as IStructure;

        if (json.version === undefined || json.version < 1 || json.version > 1) throw Error("Unknown file format");

        const desed = this.deserialiseStructBlocks(json.blocks, json.width, json.height);

        return new DeserialisedStructure(desed.blocks, { width: desed.width, height: desed.height });
    }

    /**
     * If width or height are not provided, the structure may be trimmed (empty blocks).
     * 
     * This is ideal if you want the trimmed structure in that case.
     */
    static deserialiseStructBlocks(struct: IStructureBlocks, width?: number, height?: number) {
        const { args, blocks, mapping } = struct;

        const deBlocks = [[], [], []] as [Block[][], Block[][], Block[][]];
        
        let isMissing = width === undefined || height === undefined;

        if (width !== undefined && height !== undefined) {
            for (let x = 0; x < width; x++) {
                deBlocks[0][x] = [];
                deBlocks[1][x] = [];
                deBlocks[2][x] = [];

                for (let y = 0; y < height; y++) {
                    deBlocks[0][x][y] = new Block(0);
                    deBlocks[1][x][y] = new Block(0);
                    deBlocks[2][x][y] = new Block(0);
                }
            }
        }

        let big = { x: 0, y: 0 };

        for (let i = 0, ien = blocks.length; i < ien; i++) {
            // While foreground and background layers are only supported for now, it's possible there are more layers in the future.
            for (let l = 0, len = blocks[i].length; l < len; l++) {
                for (let b = 0, ben = blocks[i][l].length; b < ben; b++) {
                    const block = blocks[i][l][b];

                    // It's a bit spammy and a lot of checks so this will only trigger if width/height are missing
                    // This is also to prevent errors, the missing elements will then be filled at the end.
                    if (isMissing) {
                        if (deBlocks[l] === undefined) deBlocks[l] = [];
                        if (deBlocks[l][block[0]] === undefined) deBlocks[l][block[0]] = [];

                        if (block[0] > big.x) big.x = block[0];
                        if (block[1] > big.y) big.y = block[1];
                    }

                    const deBlock = deBlocks[l][block[0]][block[1]] = new Block(mapping[i]);

                    const fields = Block.getFieldsByBlockId(deBlock.bId);

                    for (let a = 2, alen = block.length; a < alen; a++) {
                        let arg = args[block[a]];

                        if (typeof arg === "string" && arg.startsWith("\x00")) arg = Uint8Array.from(arg.slice(1));

                        deBlock.args[fields[a - 2].Name] = arg;
                    }
                }
            }
        }

        if (width === undefined || height === undefined) {
            for (let x = 0; x < big.x; x++) {
                deBlocks[0][x] ??= [];
                deBlocks[1][x] ??= [];
                deBlocks[2][x] ??= [];

                for (let y = 0; y < big.y; y++) {
                    deBlocks[0][x][y] ??= new Block(0);
                    deBlocks[1][x][y] ??= new Block(0);
                    deBlocks[2][x][y] ??= new Block(0);
                }
            }

            return {
                blocks: deBlocks,
                width: big.x, height: big.y
            };
        }

        return {
            blocks: deBlocks,
            width, height
        };
    }
}

/**
 * Represents the structure in its deserialised form, allows for modification
 */
export class DeserialisedStructure {
    blocks: [Block[][], Block[][], Block[][]];

    width: number;
    height: number;

    constructor(blocks: [Block[][], Block[][], Block[][]], struct: Omit<IStructure, "version"|"blocks">) {
        this.blocks = blocks;
        this.width = struct.width;
        this.height = struct.height;
    }

    /**
     * This will return a new object that meets IStructureBlocks interface.
     * 
     * NOTE: This requires you to have called API getlistblocks (unless you have joined the world)
     */
    getSerialisedBlocks() : IStructureBlocks {
        const blocks:[[x: number, y: number, ...argMapping: number[]][], [x: number, y: number, ...argMapping: number[]][], [x: number, y: number, ...argMapping: number[]][]][] = [];

        const args:BlockArg[] = [];
        const mapping:string[] = [];

        // corresponds to the index in mapping array.
        const mappingDone = {} as Record<number, number>;
        const argDone = new Map<BlockArg, number>();

        for (let l = 0; l < this.blocks.length; l++) {
            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    const block = this.blocks[l][x][y];
                    const blockName = block.name;

                    if (block.bId === 0) continue;

                    if (mappingDone[block.bId] === undefined) {
                        mappingDone[block.bId] = mapping.push(blockName) - 1;
                        blocks[mappingDone[block.bId]] = [[], [], []];
                    }

                    const index = mappingDone[block.bId];

                    if (blocks[index][l] === undefined) blocks[index][l] = [];

                    const toPut = [x, y] as [number, number, ...number[]];

                    // const keys = Object.keys(block.args);
                    const args = Block.getArgsAsArray(block);

                    for (let a = 0, argsLen = args.length; a < argsLen; a++) {
                        const arg = (args[a] instanceof Uint8Array) ? "\x00" + args[a]?.toString() : args[a];

                        let argIndex = argDone.get(arg);

                        if (argIndex === undefined) {
                            argIndex = argDone.set(arg, args.push(arg) - 1).get(arg);
                        }

                        if (argIndex === undefined) throw Error("This should be impossible at this point, but left for type safety.");

                        toPut[2 + a] = argIndex;
                    }

                    // for (let a = 0, argsLen = keys.length; a < argsLen; a++) {
                    //     const arg = Buffer.isBuffer(block.args[keys[a]]) ? "\x00" + block.args[keys[a]].toString() : block.args[keys[a]];

                    //     let argIndex = argDone.get(arg);

                    //     if (argIndex === undefined) {
                    //         argDone.set(arg, args.push(arg) - 1);
                    //         argIndex = argDone.get(arg);
                    //     }

                    //     if (argIndex === undefined)

                    //     toPut[2 + a] = argIndex;
                    // }

                    blocks[index][l].push(toPut);
                }
            }
        }

        return {
            mapping,
            args,
            blocks
        };
    }

    /**
     * This will return the structure form, giving you the freedom to choose your own way of saving.
     */
    toStruct() : IStructure {
        const struct = this.getSerialisedBlocks();

        return {
            width: this.width,
            height: this.height,
            version: 1,
            blocks: struct
        } satisfies IStructure;
    }

    /**
     * Buffer form of the structure.
     * 
     * Ideal for server runtimes (and browser if polyfilled)
     */
    toBuffer() {
        return Buffer.from(this.toJSONString());
    }

    /**
     * The JSON stringified of the structure.
     */
    toJSONString(space?: number) {
        return JSON.stringify(this.toStruct(), undefined, space);
    }

    /**
     * (This is for browser client or Bun)
     * 
     * Blob form of the structure.
     */
    toBlob() {
        return new Blob([this.toJSONString()]);
    }

    /**
     * Uint8Array form of the structure.
     */
    toBytes() {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(this.toJSONString());

        return bytes;
    }

    /**
     * This will return a list of packets containing all of the blocks.
     */
    toPackets(x: number, y: number) : SendableBlockPacket[];
    /**
     * This will return a list of packets containing all of the blocks.
     * 
     * If you pass in the blocks (from PWGameWorldHelper) for the 3rd parameter, this will be used to check for any already placed blocks.
     */
    toPackets(x: number, y: number, helper: PWGameWorldHelper) : SendableBlockPacket[];
    toPackets(x: number, y: number, helper?: PWGameWorldHelper) {
        const blockies:{ block: Block, layer: LayerType, pos: Point }[] = [];

        if (helper) {
            const maxWidth = this.width + x;
            const maxHeight = this.height + y;

            for (let l = 0; l < helper.blocks.length; l++) {
                for (let x2 = x; x2 < helper.width && x2 < maxWidth; x2++) {
                    for (let y2 = y; y2 < helper.height && y2 < maxHeight; y2++) {
                        const currBlock = helper.blocks[l][x2][y2];
                        const structBlock = this.blocks[l][x2 - x][y2 - y];

                        if (!currBlock.compareTo(structBlock))
                            blockies.push({ block: helper.blocks[l][x2][y2], layer: l, pos: { x: x2, y: y2 } });
                    }
                }
            }
        }
        else {
            for (let l = 0; l < this.blocks.length; l++) {
                for (let x2 = 0; x2 < this.width; x2++) {
                    for (let y2 = 0; y2 < this.height; y2++) {
                        blockies.push({ block: this.blocks[l][x2][y2], layer: l, pos: { x: x + x2, y: y + y2 } });
                    }
                }
            }
        }

        return createBlockPackets(blockies);
    }
}

export interface IStructure {
    /**
     * Version of the structure object, not the world.
     */
    version: number;
    /**
     * The maximum width of the structure.
     */
    width: number;
    /**
     * The maximum height of the structure.
     */
    height: number;

    /**
     * Object containing the mappings and the blocks.
     */
    blocks: IStructureBlocks;
}

export interface IStructureBlocks {
    /**
     * Index starts at 0, this is the mapping of blocks (in block name ids in UPPER_CASE)
     */
    mapping: string[];

    /**
     * Index starts at 0, this is the mapping of args (2nd elements and beyond in each block pos in blocks)
     */
    args: BlockArg[];

    /**
     * If array, it's index corresponds to the mapping, the element will be array of locations and args indexed by layers
     * (while impossible, it's for possible compatibility with mirrored blocks, foreground block in background layer etc)
     * 
     * If argMapping exists in a block, it'll be an index that corresponds to the block's arguments in args array.
     * 
     * If string, it's the encoded version of the object, use atob then JSON parse.
     */
    blocks: [
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][]
    ][];
}