import type { AnyBlockField } from "pw-js-api";
import Block from "./Block.js";
import type { LayerType } from "./Constants.js";
import type PWGameWorldHelper from "./Helper.js";
import type { BlockArg, Point, SendableBlockPacket } from "./types";
import { createBlockPackets, find } from "./util/Misc.js";
import { LegacyIncorrectArgError } from "./util/Error.js";

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
     * @param data Either the structure form or the raw data, in Uint8array, including Buffer.
     */
    static read(data: Buffer | Uint8Array | IStructure) {
        if (data instanceof Uint8Array) {
            const decoder = new TextDecoder();
            data = JSON.parse(decoder.decode(data));
        }

        const json = "version" in data ? data : JSON.parse(data.toString()) as IStructure;

        switch (json.version) {
            case 1: case 2:
                const desed = this.deserialiseStructBlocks(json.blocks, json.width, json.height);

                return new DeserialisedStructure(desed.blocks, { width: desed.width, height: desed.height });
            default:
                throw Error("Unknown file format");
        }
    }

    /**
     * If width or height are not provided, the structure may be trimmed (empty blocks).
     * 
     * This is ideal if you want the trimmed structure in that case.
     */
    static deserialiseStructBlocks(struct: IStructureBlocks, width?: number, height?: number) {
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
        
        const { blocks, mapping } = struct;

        // TODO: if v3 is created in the future, this will require a significant code revamp but for now this will work
        let version = -1;
        let argsMapping:BlockArg[];
        let fieldsMapping:string[] = [];

        if ("version" in struct) {
            // TODO: change if v3 or above
            
            version = struct.version;

            argsMapping = struct.argsMapping;
            fieldsMapping = struct.fieldsMapping;
        } else {
            // legacy support
            argsMapping = struct.args;
            version = 1;
        }

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
                        let arg = argsMapping[block[a]];
                        let field:AnyBlockField;

                        if (version > 1) {
                            const fieldName = fieldsMapping[block[++a]];

                            field = find(fields, v => v.Name === fieldName)!;

                            if (field === undefined)
                                throw new LegacyIncorrectArgError(`The field '${fieldName}' no longer exists for block '${mapping[i]}'`, deBlock.bId, fieldName);
                        } else {
                            field = fields[a - 2];
                        }

                        if (typeof arg === "string" && arg.startsWith("\x00")) arg = Uint8Array.from(arg.slice(1).split(","));
                        else {
                            switch (field.Type) {
                                case "Boolean": arg = !!arg; break; // legacy support: idk what happened here
                                case "String": arg = String(arg); break; // legacy support: world portal ids are now string.
                            }
                        }

                        deBlock.args[field.Name] = arg;
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
    getSerialisedBlocks() : IStructureBlocksV2 {
        const blocks:[[x: number, y: number, ...argMapping: number[]][], [x: number, y: number, ...argMapping: number[]][], [x: number, y: number, ...argMapping: number[]][]][] = [];

        const argsMapping:BlockArg[] = [];
        const fieldsMapping:string[] = [];
        const mapping:string[] = [];

        // corresponds to the index in mapping array.
        const argDone = new Map<BlockArg, number>();
        const fieldDone = new Map<string, number>();
        const mappingDone = {} as Record<number, number>;

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

                    const blockArgs = Block.validateArgs(block);

                    for (let a = 0, len = blockArgs.keys.length; a < len; a++) {
                        const key = blockArgs.keys[a];
                        const val = (blockArgs.values[a] instanceof Uint8Array) ? "\x00" + blockArgs.values[a]?.toString() : blockArgs.values[a];

                        let argIndex = argDone.get(val);
                        let fieldIndex = fieldDone.get(key);

                        if (argIndex === undefined) {
                            argIndex = argDone.set(val, argsMapping.push(val) - 1).get(val);
                        }

                        if (fieldIndex === undefined) {
                            fieldIndex = fieldDone.set(key, fieldsMapping.push(key) - 1).get(key);
                        }
                        
                        if (argIndex === undefined || fieldIndex === undefined) throw Error("This should be impossible at this point, but left for type safety.");
                        
                        // 0 - 2, 3
                        // 1 - 4, 5
                        // 2 - 6, 7
                        toPut[2 + (a * 2)] = argIndex;
                        toPut[2 + (a * 2) + 1] = fieldIndex;
                    }

                    blocks[index][l].push(toPut);
                }
            }
        }

        return {
            version: 2,

            argsMapping,
            fieldsMapping,            
            mapping,
            blocks
        };
    }

    /**
     * This will return the structure form, giving you the freedom to choose your own way of saving.
     */
    toStruct() : IStructure {
        const struct = this.getSerialisedBlocks();

        return {
            version: 2,
            width: this.width,
            height: this.height,
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
                        const currBlock = helper.blocks[l][x2 - x][y2 - y];
                        const structBlock = this.blocks[l][x2 - x][y2 - y];

                        if (!currBlock.compareTo(structBlock))
                            blockies.push({ block: this.blocks[l][x2][y2], layer: l, pos: { x: x2, y: y2 } });
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

export type IStructure = IStructureV1 | IStructureV2;

export interface IStructureV1 {
    /**
     * Version of the structure object, not the world.
     */
    version: 1;
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
    blocks: IStructureBlocksV1;
}

export interface IStructureV2 {
    /**
     * Version of the structure object, not the world.
     */
    version: 2;
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
    blocks: IStructureBlocksV2;
}

export type IStructureBlocks = IStructureBlocksV1 | IStructureBlocksV2;

export interface IStructureBlocksV1 {
    /**
     * Index starts at 0, this is the mapping of palette IDs (block name ids in UPPER_CASE)
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
     */
    blocks: [
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][]
    ][];
}

export interface IStructureBlocksV2 {
    // Kind of a shame to realise this now
    /**
     * Version of the structured blocks.
     */
    version: 2;

    /**
     * Index starts at 0, this is the mapping of palette IDs (block name ids in UPPER_CASE)
     */
    mapping: string[];

    /**
     * Index starts at 0, this is the mapping of field names (for example, a portal block will have "rotation" and "id" so 0 - rotation, 1 - id)
     */
    fieldsMapping: string[]

    /**
     * Index starts at 0, this is the mapping of args in blocks, after the y (see blocks for further desc)
     */
    argsMapping: BlockArg[];

    /**
     * If array, it's index corresponds to the mapping, the element will be array of locations and args indexed by layers
     * (while impossible, it's for possible compatibility with mirrored blocks, foreground block in background layer etc)
     * 
     * If argMapping exists in a block, there will be 2 elements for every arg
     * - 1st is the pointer to the field/arg value in argsMapping.
     * - 2nd is the pointer to the field/arg name in fieldsMapping.
     */
    blocks: [
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][],
        [x: number, y: number, ...argMapping: number[]][]
    ][];
}