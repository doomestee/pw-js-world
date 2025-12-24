import type { BlockArg, Point, SendableBlockPacket } from "./types/index.js";
import BufferReader, { ComponentTypeHeader } from "./BufferReader.js";
import { LayerType } from "./Constants.js";
import { AnyBlockField, OmitRecursively, ProtoGen, PWApiClient, type BlockKeys } from "pw-js-api";
import { MissingBlockError } from "./util/Error.js";
import { compareObjs, listedFieldTypeToGameType } from "./util/Misc.js";

export default class Block {
    bId: number;
    /**
     * NOTE as of October 2025, this is an object NOT an array.
     * 
     * Stores the arguments
     */
    args: Record<string, BlockArg> = {};

    constructor(bId: number | BlockKeys | string, args?: BlockArg[] | OmitRecursively<Record<string, ProtoGen.BlockFieldValue>, "$typeName"|"$unknown">) {
        if (typeof bId === "number") this.bId = bId;
        else {
            this.bId = Block.getIdByName(bId);
        }

        if (args) {
            // LEGACY SUPPORT
            if (Array.isArray(args)) {
                args = Block.getArgsAsFields(this);
            }// else {
                const keys = Object.keys(args);

                if (keys.length > 0) {
                    for (let i = 0, ken = keys.length; i < ken; i++) {
                        const arg = args[keys[i]];
                        const val = arg.value;

                        switch (arg.value.case) {
                            default:
                                // TODO: error handling?
                            case "boolValue": case "byteArrayValue": case "stringValue":
                            case "uint32Value": case "int32Value":
                                this.args[keys[i]] = val.value as NonNullable<ProtoGen.BlockFieldValue["value"]["value"]>;
                        }
                    }
                }
            //}
        }
    }

    /**
     * True if there is at least one argument, otherwise false.
     */
    hasArgs() : boolean {
        return Object.keys(this.args).length > 0;
    }

    /**
     * This is for the fields parameter in sending world block placement.
     */
    static getArgsAsFields(block: Block) : OmitRecursively<ProtoGen.WorldBlockPlacedPacket["fields"], "$typeName"> 
    static getArgsAsFields(bId: number, args?: Record<string, BlockArg>) : OmitRecursively<ProtoGen.WorldBlockPlacedPacket["fields"], "$typeName"> 
    static getArgsAsFields(bId: number | Block, args?: Record<string, BlockArg>) {
        if (bId instanceof Block) {
            args = bId.args;
            bId = bId.bId;
        }

        if (args === undefined) return {};

        const fields = Block.getFieldsByBlockId(bId);

        const obj:OmitRecursively<ProtoGen.WorldBlockPlacedPacket["fields"], "$typeName"> = {};

        for (let i = 0, len = fields.length; i < len; i++) {
            const f = fields[i];

            if (f.Required === true && args[f.Name] === undefined) throw Error(`Missing argument: ${f.Name} (Type: ${f.Type})`);
            else if (f.Required === false && args[f.Name] === undefined) continue;

            obj[f.Name] = {
                value: {
                    case: listedFieldTypeToGameType(f.Type),
                    value: args[f.Name]
                } as { case: "uint32Value", value: number }
            }
        }

        return obj;
    }

    /**
     * 
     */
    static getArgsAsArray(block: Block) : BlockArg[]
    static getArgsAsArray(bId: number, args?: Record<string, BlockArg>) : BlockArg[]
    static getArgsAsArray(bId: number | Block, args?: Record<string, BlockArg>) {
        if (bId instanceof Block) {
            args = bId.args;
            bId = bId.bId;
        }

        if (args === undefined) return [];

        const arr:BlockArg[] = [];
        const fields = Block.getFieldsByBlockId(bId);

        for (let i = 0, len = fields.length; i < len; i++) {
            const f = fields[i];
            const val = args[f.Name];

            if (f.Required === true && val === undefined) throw Error(`Missing argument: ${f.Name} (Type: ${f.Type})`);
            else if (f.Required === false && args[f.Name] === undefined) arr.push(undefined);

            arr.push(args[fields[i].Name])
        }

        return arr;
    }

    // /**
    //  * Serializes the block into a buffer. This is used to convert
    //  * the block into a binary format that can be sent over the game
    //  * server. As this is static, block id and args are required.
    //  *
    //  * - Little Endian
    //  * - With Id
    //  * - Type Byte omitted
    //  */
    // public static serializeArgs(bId: number, args: BlockArg[]): Buffer;

    // /**
    //  * Serializes the block into a buffer. This is used to convert
    //  * the block into a binary format that can be sent over the game
    //  * server. As this is static, block id and args are required.
    //  *
    //  * - Big Endian
    //  * - No Id
    //  * - Type Byte included
    //  */
    // public static serializeArgs(bId: number, args: BlockArg[], options: { endian: "big"; writeId: false; readTypeByte: true }): Buffer;
    // public static serializeArgs(bId: number, args: BlockArg[], options: { endian: "little"; writeId: false; readTypeByte: true }): Buffer;

    // public static serializeArgs(bId: number, args: BlockArg[], options?: { endian: "little" | "big"; writeId: boolean; readTypeByte: boolean }): Buffer {
    //     options ||= {
    //         endian: "little",
    //         writeId: true,
    //         readTypeByte: false,
    //     };

    //     const buffer: Buffer[] = [];

    //     if (options.writeId) {
    //         const idBuffer = Buffer.alloc(4);
    //         idBuffer.writeUInt32LE(bId);
    //         buffer.push(idBuffer);
    //     }

    //     const blockData:ComponentTypeHeader[] = Block.getArgTypesByBlockId(bId);

    //     for (let i = 0, len = blockData.length; i < len; i++) {
    //         const entry = BufferReader.Dynamic(blockData[i], args[i]);
    //         buffer.push(entry);
    //     }

    //     return Buffer.concat(buffer);
    // }

    /**
     * Returns an object suitable for sending worldBlockPlacedPacket to connection.
     * @param pos List of possible positions (a max of 250 positions) - this does not automatically truncate if it overfills.
     */
    toPacket(pos: Point[], layer: LayerType) : SendableBlockPacket;
    toPacket(x: number, y: number, layer: LayerType) : SendableBlockPacket;
    toPacket(pos: Point[] | number, y: number, layer?: LayerType) : SendableBlockPacket {
        if (typeof pos === "number") {
            pos = [{
                x: pos, y
            }];

            layer = layer ?? 0;
        } else layer = y ?? 0;

        return {
            isFillOperation: false,
            blockId: this.bId,
            layer,
            positions: pos,
            fields: Block.getArgsAsFields(this),
            // extraFields: Block.serializeArgs(this.bId, this.args, { endian: "big", writeId: false, readTypeByte: true })
        } satisfies SendableBlockPacket;
    }

    /**
     * This will return the block name in UPPER_CASE form.
     * 
     * For eg EFFECTS_INVULNERABILITY.
     * 
     * @throws {MissingBlockError}
     * If the ID of this block is not known.
     */
    get name() : string {
        const block = PWApiClient.listBlocks?.[this.bId];

        if (block === undefined) throw new MissingBlockError("Current block data is missing, run Api#listBlocks first?", this.bId);

        return block.PaletteId.toUpperCase();
    }

    /**
     * Returns a copy of the block.
     */
    clone(obj?: false) : Block;
    clone(obj: true) : { bId: number, args: Record<string, BlockArg>, name: string }
    clone(obj = false) {
        if (obj === true) return { bId: this.bId, args: this.args, name: this.name };

        const b = new Block(this.bId);

        b.args = structuredClone(this.args);

        return b;
    }

    compareTo(b: Block) {
        return this.bId === b.bId
                && compareObjs(this.args, b.args)
    }

    /**
     * This can be convenient as it will always return the ID if it exists, and it will throw an error if it doesn't.
     * 
     * This expects the name sent to be in full upper capital form though.
     * 
     * @throws {MissingBlockError}
     * If the connection is unknown, this can be because you're trying to use this function when Api#getListBlocks has never been invoked, or the object is missing.
     */
    static getIdByName(paletteId: string) : number {
        const block = PWApiClient.listBlocksObj?.[paletteId.toUpperCase()];

        if (block === undefined) throw new MissingBlockError("Current block data is missing, run Api#listBlocks first?", paletteId);

        return block.Id;
    }

    /**
     * This will return the corresponding palette id by the ID of that block.
     * 
     * The name sent will be in full upper capital if it exists.
     * 
     * @throws {MissingBlockError}
     * If the connection is unknown, this can be because you're trying to use this function when Api#getListBlocks has never been invoked, or the object is missing.
     */
    static getPaletteIdById(blockId: number) : string {
        const block = PWApiClient.listBlocks?.[blockId];

        if (block === undefined) throw new MissingBlockError("Current block data is missing, run Api#listBlocks first?", blockId);

        return block.PaletteId.toUpperCase();
    }

    /**
     * Returns the block fields for that block by given block ID.
     * 
     * If a block don't have args, it will return an empty array.
     * 
     * If the block don't exist, it may throw an exception.
     */
    static getFieldsByBlockId(blockId: number) : AnyBlockField[] {
        return PWApiClient.listBlocks?.[blockId].Fields ?? [];

        // const block = PWApiClient.listBlocks?.[blockId];
        
        // return block ? MissingBlockData[block?.PaletteId.toUpperCase()] ?? (block.BlockDataArgs) as ComponentTypeHeader[] ?? [] : [];
    }

    /**
     * Returns the block fields for that block by given palette ID (full upper case).
     * 
     * For eg "EMPTY" or "SIGN_GOLD"
     * 
     * If a block don't have args, it will return an empty array.
     * 
     * If the block don't exist, it may throw an exception.
     */
    static getFieldsByPaletteId(paletteId: string) : AnyBlockField[] {
        return PWApiClient.listBlocksObj?.[paletteId].Fields ?? [];
        //MissingBlockData[paletteId] ?? (PWApiClient.listBlocksObj?.[paletteId].BlockDataArgs) as ComponentTypeHeader[] ?? []
    }
}

// Temporary fix as some blocks currently have incorrect args
// const MissingBlockData = {
//     SWITCH_LOCAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Byte],
//     SWITCH_GLOBAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Byte],
// } as Record<string, ComponentTypeHeader[]>;