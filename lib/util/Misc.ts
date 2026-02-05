import { type LayerType, MAX_WORLD_BLOCK_PLACED_PACKET_POSITION_SIZE } from "../Constants.js";
import type { BlockArg, Point } from "../types";
import Block from "../Block.js";
import { ISendablePacket, type AnyBlockField, type BlockKeys } from "pw-js-api";
import Label from "../Label.js";

// const aaa = {
//     hi: 0
// };

// // setInterval(() => {
// //     console.log(aaa.hi);
// // }, 1);

/**
 * True if objA matches the contents to that of objB
 * 
 * TODO: proper array support?
 */
export function compareObjs<A extends Record<string, any>, B extends Record<string, any>>(objA: A, objB: B) : boolean {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    // console.log(objA, objB);

    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        const valA = objA[keysA[i]];
        const valB = objB[keysA[i]];

        if (typeof valA !== typeof valB) return false;

        // in case they're both undefined...?
        if (valA === valB) continue;

        if (valB === undefined) return false;

        if (typeof valA === "object" && typeof valB === "object") {
            const isArray = [Array.isArray(valA), Array.isArray(valB)];

            if (isArray[0] && !isArray[1]) return false;
            if (!isArray[0] && isArray[1]) return false;
            
            // TODO: proper array support?
            if (isArray[0] && isArray[1]) {
                if (valA.length !== valB.length) return false;

                for (let j = 0; j < valA.length; j++) {
                    if (valA[j] !== valB[j]) return false;
                }
            } else {
                if (!compareObjs(valA, valB)) return false;
            }
        } else if (valA !== valB) return false;
    }

    return true;
}

export function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a === b) {
        return true
    }

    if (a.byteLength !== b.byteLength) {
        return false
    }

    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}

export function map<T, U>(arr: Array<T> | Map<any, T>, cb: (value: T, index: number, obj: T[]) => U) : U[] {
    const res:U[] = [];

    if (!Array.isArray(arr)) arr = Array.from(arr.values());

    for (let i = 0, len = arr.length; i < len; i++) {
        res[i] = cb(arr[i], i, arr);
        // if (pred(arr[i], i, arr)) res.push(arr[i]);
    }

    return res;
}

export function find<T>(arr: Array<T> | Map<any, T>, pred: (value: T, index: number, obj: T[]) => boolean) : T | undefined {
    if (!Array.isArray(arr)) arr = Array.from(arr.values());

    for (let i = 0, len = arr.length; i < len; i++) {
        if (pred(arr[i], i, arr)) return arr[i];
    }
    return undefined;
}

export function findIndex<T>(arr: Array<T> | Map<any, T>, pred: (value: T, index: number, obj: T[]) => boolean) : number {
    if (!Array.isArray(arr)) arr = Array.from(arr.values());

    for (let i = 0, len = arr.length; i < len; i++) {
        if (pred(arr[i], i, arr)) return i;
    }
    return -1;
}

/**
 * For now this is slightly limited, but this will ONLY create a sendable packet which you must then send it yourself.
 */
export function createBlockPacket(blockId: number | BlockKeys | string, layer: LayerType, pos: Point | Point[], args: Record<string, BlockArg>) : ISendablePacket<"worldBlockPlacedPacket">;
export function createBlockPacket(block: Block, layer: LayerType, pos: Point | Point[]) : ISendablePacket<"worldBlockPlacedPacket">;
export function createBlockPacket(blockId: number | BlockKeys | string | Block, layer: LayerType, pos: Point | Point[], args?: Record<string, BlockArg>) {
    if (blockId instanceof Block) {
        args = blockId.args;
        blockId = blockId.bId
    }
    else if (typeof blockId !== "number") {
        blockId = Block.getIdByName(blockId);
    }

    if (blockId === undefined) throw Error("Unknown block ID");
    if (layer === undefined || layer < 0 || layer > 2) throw Error("Unknown layer type");

    if (!Array.isArray(pos)) pos = [pos];

    return {
        type: "worldBlockPlacedPacket",
        packet: {
            blockId,
            layer,
            positions: pos,
            fields: Block.getArgsAsFields(blockId, args)
        }
    } satisfies ISendablePacket<"worldBlockPlacedPacket">;
}

/**
 * Creates sendable packets from given blocks. Attempts to minimise packet count, so it's preferable
 * to use it over creating packets with createBlockPacket multiple times.
 * 
 * Labels can be passed, must be the second parameter.
 */
export function createBlockPackets(blocks: { block: Block, layer: LayerType, pos: Point }[]) : ISendablePacket<"worldBlockPlacedPacket">[]
/**
 * NOTE: If you're passing a Map of labels, pass in the .values() of the map.
 */
export function createBlockPackets(blocks: { block: Block, layer: LayerType, pos: Point }[], labels: Iterable<Label>) : ISendablePacket<"worldBlockPlacedPacket"|"worldLabelUpsertPacket">[]
export function createBlockPackets(blocks: { block: Block, layer: LayerType, pos: Point }[], labels: Iterable<Label> = []) {
    // Exact max packet position size is unknown, but it was noticed, it works correctly with this size

    // This is deliberate choice so that the typing won't complain since iterable don't have a common property
    let listWithLabels:ISendablePacket<"worldBlockPlacedPacket"|"worldLabelUpsertPacket">[] = [];
    const list:ISendablePacket<"worldBlockPlacedPacket">[] = listWithLabels = [];

    for (let i = 0, len = blocks.length; i < len; i++) {
        const block = blocks[i];
        const packet = createBlockPacket(block.block, block.layer, block.pos);

        let existingPacket:ISendablePacket<"worldBlockPlacedPacket"> | undefined;

        for (let j = 0, jen = list.length; j < jen; j++) {
            const currPacket = list[j].packet;

            if (currPacket?.blockId === block.block.bId &&
                currPacket.layer === block.layer &&
                currPacket.positions.length < MAX_WORLD_BLOCK_PLACED_PACKET_POSITION_SIZE &&
                currPacket.fields && packet.packet?.fields &&
                compareObjs(currPacket.fields, packet.packet?.fields)
            ) {
                existingPacket = list[j];
            }
        }

        if (existingPacket?.packet) {
            const pos = existingPacket.packet.positions;

            for (let j = 0, jen = pos.length; j < jen; j++) {
                if (block.pos.x !== pos[j].x || block.pos.y !== pos[j].y) {
                    pos.push(block.pos);
                    break;
                }
            }

        } else list.push(packet);
    }

    if (labels) {
        for (const label of labels) {
            listWithLabels.push(
                label.toPacket()
            );
        }
    }
    
    return list;
}

/**
 * Since this is literally the only function related to dealing with binary stuff, a file would be redundant.
 * 
 * Credits: Priddle / NVD https://discord.com/channels/534079923573489667/1230093943941758977/1431632635645530234
 */
export function read7BitEncodedInt(reader: Uint8Array, offset: { val: number }): number {
    let value = 0;
    let shift = 0;
    let byte: number;

    do {
        byte = reader[offset.val++];
        value |= (byte & 0x7F) << shift;
        shift += 7;
    } while ((byte & 0x80) != 0);
    return value;
}

/**
 * I don't know what else to call this.
 * 
 * This will convert the type from getListedBlocks#fields to match the one from the game.
 */
export function listedFieldTypeToGameType(type: AnyBlockField["Type"]) {
    switch (type) {
        case "String": return "stringValue";
        case "Int32": return "int32Value";
        case "UInt32": return "uint32Value";
        case "Boolean": return "boolValue";
        
        case "DrumNote[]":
        case "PianoNote[]":
        case "GuitarNote[]":
            return "byteArrayValue";

        default:
            throw Error("Unknown field type (" + type + ") - PLEASE CONTACT LIBRARY MAINTAINER (Doomester)");
    }
}