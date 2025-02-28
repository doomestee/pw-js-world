import type { BlockArg, Point, SendableBlockPacket } from "./types/index.js";
import BufferReader, { ComponentTypeHeader } from "./BufferReader.js";
import { LayerType } from "./Constants.js";
import { PWApiClient, type BlockKeys } from "pw-js-api";
import { MissingBlockError } from "./util/Error.js";

export default class Block {
    bId: number;
    args: BlockArg[] = [];

    constructor(bId: number | BlockKeys | string, args?: BlockArg[]) {
        if (typeof bId === "number") this.bId = bId;
        else {
            this.bId = Block.getIdByName(bId);
        }

        if (args) this.args = args;
    }

    /**
     * I mean... Just use .args.length !== 0 to see if it has args.
     * 
     * But anyway, this will return true if there is at least one args, otherwise false.
     */
    hasArgs() : boolean {
        return this.args.length !== 0;
    }

    /**
     * For helper.
     * 
     * This is in Block class for organisation.
     * 
     * This will deserialise by using the reader to get the block ID then retrieve the args, if applicable.
     */
    static deserialize(reader: BufferReader) : Block {
        return new Block(reader.readUInt32LE()).deserializeArgs(reader);
    }

    protected deserializeArgs(reader: BufferReader, flag = false) : this {
        const format: ComponentTypeHeader[] = (BlockArgsHeadings as any)[this.name];

        for (let i = 0; i < (format?.length ?? 0); i++) {
            if (flag) {
                reader.expectUInt8(format[i]);
            }

            this.args[i] = reader.read(format[i], !flag);
        }

        return this;
    }
    
    /**
     * For helper.
     * 
     * This is in Block class for organisation.
     */
    static deserializeArgs(reader: BufferReader) : BlockArg[] {
        // const args = 

        return reader.deserialize();

        // for (let i = 0; i < (format?.length ?? 0); i++) {
        //     if (flag) {
        //         reader.expectUInt8(format[i]);
        //     }

        //     args[i] = reader.read(format[i], !flag);
        // }

        // return args;
    }
    
    /**
     * Serializes the block into a buffer. This is used to convert
     * the block into a binary format that can be sent over the game
     * server. As this is static, block id and args are required.
     *
     * - Little Endian
     * - With Id
     * - Type Byte omitted
     */
    public static serializeArgs(bId: number, args: BlockArg[]): Buffer;

    /**
     * Serializes the block into a buffer. This is used to convert
     * the block into a binary format that can be sent over the game
     * server. As this is static, block id and args are required.
     *
     * - Big Endian
     * - No Id
     * - Type Byte included
     */
    public static serializeArgs(bId: number, args: BlockArg[], options: { endian: "big"; writeId: false; readTypeByte: true }): Buffer;
    public static serializeArgs(bId: number, args: BlockArg[], options: { endian: "little"; writeId: false; readTypeByte: true }): Buffer;

    public static serializeArgs(bId: number, args: BlockArg[], options?: { endian: "little" | "big"; writeId: boolean; readTypeByte: boolean }): Buffer {
        options ||= {
            endian: "little",
            writeId: true,
            readTypeByte: false,
        };

        const buffer: Buffer[] = [];

        if (options.writeId) {
            const idBuffer = Buffer.alloc(4);
            idBuffer.writeUInt32LE(bId);
            buffer.push(idBuffer);
        }

        const blockData:ComponentTypeHeader[] = (BlockArgsHeadings as any)[this.getPaletteIdById(bId)] ?? [];

        for (let i = 0, len = blockData.length; i < len; i++) {
            const entry = BufferReader.Dynamic(blockData[i], args[i]);
            buffer.push(entry);
        }

        return Buffer.concat(buffer);
    }

    /**
     * 
     * @param pos List of points (X and Y)
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
            extraFields: Block.serializeArgs(this.bId, this.args, { endian: "big", writeId: false, readTypeByte: true })
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
    clone(obj: true) : { bId: number, args: BlockArg[], name: string }
    clone(obj = false) {
        if (obj === true) return { bId: this.bId, args: this.args, name: this.name };

        return new Block(this.bId, this.args);
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
        const block = PWApiClient.listBlocksObj?.[paletteId];

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
}

/**
 * This mapping contains definitions of block data which require additional
 * arguments to be sent or received with.
 */
export const BlockArgsHeadings = {
    COIN_GOLD_DOOR: [ComponentTypeHeader.Int32],
    COIN_BLUE_DOOR: [ComponentTypeHeader.Int32],
    COIN_GOLD_GATE: [ComponentTypeHeader.Int32],
    COIN_BLUE_GATE: [ComponentTypeHeader.Int32],

    EFFECTS_JUMP_HEIGHT: [ComponentTypeHeader.Int32],
    EFFECTS_FLY: [ComponentTypeHeader.Boolean],
    EFFECTS_SPEED: [ComponentTypeHeader.Int32],
    EFFECTS_INVULNERABILITY: [ComponentTypeHeader.Boolean],
    EFFECTS_CURSE: [ComponentTypeHeader.Int32],
    EFFECTS_ZOMBIE: [ComponentTypeHeader.Int32],
    EFFECTS_GRAVITYFORCE: [ComponentTypeHeader.Int32],
    EFFECTS_MULTI_JUMP: [ComponentTypeHeader.Int32],
    // gravity effects no data
    // effects off
    // effects zombie

    TOOL_PORTAL_WORLD_SPAWN: [ComponentTypeHeader.Int32],

    SIGN_NORMAL: [ComponentTypeHeader.String],
    SIGN_RED: [ComponentTypeHeader.String],
    SIGN_GREEN: [ComponentTypeHeader.String],
    SIGN_BLUE: [ComponentTypeHeader.String],
    SIGN_GOLD: [ComponentTypeHeader.String],

    PORTAL: [ComponentTypeHeader.Int32, ComponentTypeHeader.Int32, ComponentTypeHeader.Int32],
    PORTAL_INVISIBLE: [ComponentTypeHeader.Int32, ComponentTypeHeader.Int32, ComponentTypeHeader.Int32],
    PORTAL_WORLD: [ComponentTypeHeader.String, ComponentTypeHeader.Int32],

    SWITCH_LOCAL_TOGGLE: [ComponentTypeHeader.Int32],
    SWITCH_LOCAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Byte],
    SWITCH_LOCAL_RESETTER: [ComponentTypeHeader.Byte],
    SWITCH_LOCAL_DOOR: [ComponentTypeHeader.Int32],
    SWITCH_LOCAL_GATE: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_TOGGLE: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Byte],
    SWITCH_GLOBAL_RESETTER: [ComponentTypeHeader.Byte],
    SWITCH_GLOBAL_DOOR: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_GATE: [ComponentTypeHeader.Int32],

    HAZARD_DEATH_DOOR: [ComponentTypeHeader.Int32],
    HAZARD_DEATH_GATE: [ComponentTypeHeader.Int32],

    NOTE_DRUM: [ComponentTypeHeader.ByteArray],
    NOTE_PIANO: [ComponentTypeHeader.ByteArray],
    NOTE_GUITAR: [ComponentTypeHeader.ByteArray],

    CUSTOM_SOLID_BG: [ComponentTypeHeader.UInt32],
    CUSTOM_CHECKER_BG: [ComponentTypeHeader.UInt32],

    // ew
    COUNTER_WHITE_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_WHITE_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_WHITE_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_WHITE_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_WHITE_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_WHITE_GATE: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_GRAY_GATE: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_BLACK_GATE: [ComponentTypeHeader.Int32],
    COUNTER_RED_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_RED_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_RED_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_RED_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_RED_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_RED_GATE: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_ORANGE_GATE: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_YELLOW_GATE: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_GREEN_GATE: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_CYAN_GATE: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_BLUE_GATE: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_CONSUMABLE: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_CONSUMABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_REUSABLE: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_REUSABLE_SET: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_DOOR: [ComponentTypeHeader.Int32],
    COUNTER_MAGENTA_GATE: [ComponentTypeHeader.Int32],
} as const;