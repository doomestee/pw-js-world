import { BlockNames } from "pw-js-api";
import type { BlockArg, Point, SendableBlockPacket } from "./types/index.js";
import BufferReader, { ComponentTypeHeader } from "./BufferReader.js";
import { LayerType } from "./Constants.js";

export default class Block {
    bId: number;
    args: BlockArg[] = [];

    constructor(bId: number | keyof typeof BlockNames, args?: BlockArg[]) {
        if (typeof bId === "number") this.bId = bId;
        else {
            this.bId = BlockNames[bId];
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
    static deserializeArgs(blockId: number, reader: BufferReader, flag = false) : BlockArg[] {
        const format: ComponentTypeHeader[] = (BlockArgsHeadings as any)[BlockNames[blockId]];

        const args = [];

        for (let i = 0; i < (format?.length ?? 0); i++) {
            if (flag) {
                reader.expectUInt8(format[i]);
            }

            args[i] = reader.read(format[i], !flag);
        }

        return args;
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

        const blockData:ComponentTypeHeader[] = (BlockArgsHeadings as any)[BlockNames[bId]] ?? [];

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
     */
    get name() : keyof typeof BlockNames {
        return BlockNames[this.bId] as keyof typeof BlockNames;
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
    SWITCH_LOCAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Boolean],
    SWITCH_LOCAL_RESETTER: [ComponentTypeHeader.Boolean],
    SWITCH_LOCAL_DOOR: [ComponentTypeHeader.Int32],
    SWITCH_LOCAL_GATE: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_TOGGLE: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_ACTIVATOR: [ComponentTypeHeader.Int32, ComponentTypeHeader.Boolean],
    SWITCH_GLOBAL_RESETTER: [ComponentTypeHeader.Boolean],
    SWITCH_GLOBAL_DOOR: [ComponentTypeHeader.Int32],
    SWITCH_GLOBAL_GATE: [ComponentTypeHeader.Int32],

    HAZARD_DEATH_DOOR: [ComponentTypeHeader.Int32],
    HAZARD_DEATH_GATE: [ComponentTypeHeader.Int32],

    NOTE_DRUM: [ComponentTypeHeader.ByteArray],
    NOTE_PIANO: [ComponentTypeHeader.ByteArray],
    NOTE_GUITAR: [ComponentTypeHeader.ByteArray],
} as const;