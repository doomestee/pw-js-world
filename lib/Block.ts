import type { BlockArg, Point } from "./types/index.js";
import { LayerType } from "./Constants.js";
import { AnyBlockField, CleanProtoMessage, ISendablePacket, ProtoGen, PWApiClient, type BlockKeys } from "pw-js-api";
import { LegacyIncorrectArgError, LegacyIncorrectArgsLenError, MissingBlockError } from "./util/Error.js";
import { compareObjs, listedFieldTypeToGameType, map } from "./util/Misc.js";

export default class Block {
    bId: number;
    /**
     * NOTE as of October 2025, this is an object NOT an array.
     * 
     * Stores the arguments
     */
    args: Record<string, BlockArg> = {};

    /**
     * NOTE: This is a deprecated form as the arrangement of fields/args for a block may change in the future.
     */
    constructor(bId: number | BlockKeys | string, args?: BlockArg[])
    /**
     * 
     */
    constructor(bId: number | BlockKeys | string, args?: Record<string, BlockArg>)
    /**
     * @param bId ID of the block, can be the current numeric block ID, or string ID (from /listblocks).
     * @param args Arguments belonging to the block. This class does not clone.
     */
    constructor(bId: number | BlockKeys | string, args?: BlockArg[] | Record<string, BlockArg>) {
        if (typeof bId === "number") this.bId = bId;
        else {
            this.bId = Block.getIdByName(bId);
        }

        if (args) {
            // LEGACY SUPPORT
            if (Array.isArray(args)) {
                const fields = Block.getFieldsByBlockId(this.bId);

                // For now, assuming they're of the same length.

                if (args.length !== fields.length) throw new LegacyIncorrectArgsLenError("Args length is not equal to fields length for this block ID", this.bId, args.length, fields.length);

                for (let i = 0, ken = fields.length; i < ken; i++) {
                    // const arg = fieldedArgs[keys[i]];
                    const field = fields[i];
                    const arg = args[i];

                    if (field.Type === "String" && typeof arg !== "string"
                        || field.Type === "Boolean" && typeof arg !== "boolean"
                        || field.Type === "Int32" && typeof arg !== "number"
                        || field.Type === "UInt32" && typeof arg !== "number") throw new LegacyIncorrectArgError("The arg type does not match the field", this.bId, arg, field);
                    // todo: uint8array?

                    this.args[field.Name] = arg;
                }
            } else this.args = args;
        }
    }

    /**
     * This is called upon automatically (if a helper is attached) binding the args to the newly instantised block.
     * This does not validate if the fields truly belong to the block.
     * 
     * INTERNAL
     */
    _initArgs(args: CleanProtoMessage<Record<string, ProtoGen.BlockFieldValue>>) : this {
        this.args = Block.parseArgFields(args);

        return this;
    }

    /**
     * True if there is at least one argument, otherwise false.
     */
    hasArgs() : boolean {
        return Object.keys(this.args).length > 0;
    }

    /**
     * This is for the fields parameter in sending world block placement.
     * 
     * If the whole Block is passed, and the args parameter is undefined, the block's args will be used.
     */
    static getArgsAsFields(block: Block, args?: Record<string, BlockArg>) : CleanProtoMessage<ProtoGen.WorldBlockPlacedPacket["fields"]>;
    static getArgsAsFields(bId: number, args?: Record<string, BlockArg>) : CleanProtoMessage<ProtoGen.WorldBlockPlacedPacket["fields"]>;
    static getArgsAsFields(bId: number | Block, args?: Record<string, BlockArg>) {
        if (bId instanceof Block) {
            args ??= bId.args;
            bId = bId.bId;
        }

        const fields = Block.getFieldsByBlockId(bId);
        
        if (args === undefined) {
            if (fields.length > 0) throw Error(`Missing arguments: ${map(fields, v => v.Name).join(", ")}.`);

            return [];
        }

        const obj:CleanProtoMessage<ProtoGen.WorldBlockPlacedPacket["fields"]> = {};

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
     */
    static getArgsAsArray(block: Block) : BlockArg[]
    static getArgsAsArray(bId: number, args?: Record<string, BlockArg>) : BlockArg[]
    static getArgsAsArray(bId: number | Block, args?: Record<string, BlockArg>) {
        if (bId instanceof Block) {
            args ??= bId.args;
            bId = bId.bId;
        }

        const arr:BlockArg[] = [];
        const fields = Block.getFieldsByBlockId(bId);
        
        if (args === undefined) {
            if (fields.length > 0) throw Error(`Missing arguments: ${map(fields, v => v.Name).join(", ")}.`);

            return [];
        }

        for (let i = 0, len = fields.length; i < len; i++) {
            const f = fields[i];
            const val = args[f.Name];

            if (f.Required === true && val === undefined) throw Error(`Missing argument: ${f.Name} (Type: ${f.Type})`);
            else if (f.Required === false && args[f.Name] === undefined) arr.push(undefined);

            arr.push(args[fields[i].Name])
        }

        return arr;
    }

    /**
     * Checks if all required fields are present, it will also check if there are extra fields that are not used.
     * 
     * Returns an object with two lists: values and keys. The indexes of values also point to keys.
     * 
     * For example:
     * ```js
     * { values: [3, "Text is awesome."], keys: ["rotation", "text"] }
     * ```
     * 
     * NOTE: This will not error if a required field is missing. This also doesn't validate string against patterns for now.
     */
    static validateArgs(block: Block) : { values: BlockArg[], keys: string[] };
    static validateArgs(bId: number, args?: Record<string, BlockArg>) : { values: BlockArg[], keys: string[] };
    static validateArgs(bId: number | Block, args?: Record<string, BlockArg>) : { values: BlockArg[], keys: string[] } {
        if (bId instanceof Block) {
            args ??= bId.args;
            bId = bId.bId;
        }

        const obj = { keys: [] as string[], values: [] as BlockArg[] };

        const fields = Block.getFieldsByBlockId(bId);
        
        if (args === undefined) {
            if (fields.length > 0) throw Error(`Missing arguments: ${map(fields, v => v.Name).join(", ")}.`);

            return obj;
        }

        const argNames = Object.keys(args);

        for (let i = 0, len = fields.length; i < len; i++) {
            const f = fields[i];
            const val = args[f.Name];

            if (f.Required === true && val === undefined) throw Error(`Missing required argument: ${f.Name} (Type: ${f.Type})`);;
            // else if (f.Required === false && args[f.Name] === undefined) arr.push(undefined);

            if (val !== undefined)
                switch (f.Type) {
                    case "String":
                        if (typeof val !== "string") throw new LegacyIncorrectArgError(`Argument '${f.Name}' is not of correct type (${f.Type})`, bId, val);
                        break;
                    case "Int32": case "UInt32":
                        if (typeof val !== "number") throw new LegacyIncorrectArgError(`Argument '${f.Name}' is not of correct type (${f.Type})`, bId, val);

                        if (f.ExcludedValues?.includes(val)) throw new LegacyIncorrectArgError(`Argument '${f.Name}' value is in the excluded values`, bId, val);
                        if (f.MinValue > val) throw new LegacyIncorrectArgError(`Argument '${f.Name}' value lower than the minimum value (${f.MinValue})`, bId, val);
                        if (f.MaxValue < val) throw new LegacyIncorrectArgError(`Argument '${f.Name}' value lower than the maximum value (${f.MaxValue})`, bId, val);

                        break;
                    case "Boolean":
                        if (typeof val !== "boolean") throw new LegacyIncorrectArgError(`Argument '${f.Name}' is not of correct type (${f.Type})`, bId, val);

                        break;
                }

            for (let j = 0; j < argNames.length; j++) {
                if (argNames[j] === f.Name) {
                    obj.keys.push(f.Name);
                    obj.values.push(val);

                    argNames.splice(j, 1);
                    break;
                }
            }
        }

        return obj;
    }

    /**
     * This is sort of for internal use,
     * this will convert the packet form of fields
     * back into object of arg names mapped to their values.
     */
    static parseArgFields(args: CleanProtoMessage<ProtoGen.WorldBlockPlacedPacket["fields"]>) : Record<string, BlockArg> {
        const obj:Record<string, BlockArg> = {};

        const keys = Object.keys(args);

        for (let i = 0; i < keys.length; i++) {
            const arg = args[keys[i]];
            const val = arg.value;

            switch (val.case) {
                default:
                    // TODO: error handling?
                case "boolValue":
                    obj[keys[i]] = !!val.value; // server sends 0 or 1
                    break;
                case "byteArrayValue": case "stringValue":
                case "uint32Value": case "int32Value":
                    obj[keys[i]] = val.value as NonNullable<ProtoGen.BlockFieldValue["value"]["value"]>;
            }
        }

        return obj;
    }

    /**
     * Returns an object suitable for sending worldBlockPlacedPacket to connection.
     * @param pos List of possible positions (a max of 250 positions) - this does not automatically truncate if it overfills.
     */
    toPacket(pos: Point[], layer: LayerType) : ISendablePacket<"worldBlockPlacedPacket">;
    toPacket(x: number, y: number, layer: LayerType) : ISendablePacket<"worldBlockPlacedPacket">;
    toPacket(pos: Point[] | number, y: number, layer?: LayerType) : ISendablePacket<"worldBlockPlacedPacket"> {
        if (typeof pos === "number") {
            pos = [{
                x: pos, y
            }];

            layer = layer ?? 0;
        } else layer = y ?? 0;

        return {
            type: "worldBlockPlacedPacket",
            packet: {
                blockId: this.bId,
                layer,
                positions: pos,
                fields: Block.getArgsAsFields(this),
            }
            // extraFields: Block.serializeArgs(this.bId, this.args, { endian: "big", writeId: false, readTypeByte: true })
        } satisfies ISendablePacket<"worldBlockPlacedPacket">;
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
    }
}