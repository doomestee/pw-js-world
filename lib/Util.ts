import { BlockNames } from "pw-js-api";
import type { BlockKeys } from "./types/excluded";
import type { LayerType } from "./Constants";
import type { BlockArg, Point, SendableBlockPacket } from "./types";
import Block from "./Block";

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
export function createBlockPacket(blockId: number | BlockNames | BlockKeys, layer: LayerType, pos: Point | Point[], ...args: BlockArg[]) : SendableBlockPacket;
export function createBlockPacket(block: Block, layer: LayerType, pos: Point | Point[]) : SendableBlockPacket;
export function createBlockPacket(blockId: number | BlockNames | BlockKeys | Block, layer: LayerType, pos: Point | Point[], ...args: BlockArg[]) {
    if (blockId instanceof Block) {
        args = blockId.args;
        blockId = blockId.bId
    }
    else if (typeof blockId !== "number") blockId = BlockNames[blockId];

    if (blockId === undefined) throw Error("Unknown block ID");
    if (layer === undefined || layer < 0 || layer > 1) throw Error("Unknown layer type");

    if (!Array.isArray(pos)) pos = [pos];

    return {
        isFillOperation: false,
        blockId,
        layer,
        positions: pos,
        extraFields: Block.serializeArgs(blockId, args, { endian: "big", writeId: false, readTypeByte: true })
    } satisfies SendableBlockPacket;
}

/**
 * Creates sendable packets from given blocks. Attempts to minimise packet count, so it's preferable
 * to use it over creating packets with createBlockPacket multiple times.
 */
export function createBlockPackets(blocks: { block: Block, layer: LayerType, pos: Point }[]) : SendableBlockPacket[] {
    // Exact max packet position size is unknown, but it was noticed, it works correctly with this size
    const MAX_WORLD_BLOCK_PLACED_PACKET_POSITION_SIZE = 200;

    const list:SendableBlockPacket[] = [];

    for (let i = 0, len = blocks.length; i < len; i++) {
        const block = blocks[i];
        const packet = createBlockPacket(block.block, block.layer, block.pos);

        const existingPacket = find(list, pack => 
            pack.blockId === block.block.bId &&
            pack.layer === block.layer &&
            pack.positions.length < MAX_WORLD_BLOCK_PLACED_PACKET_POSITION_SIZE &&
            uint8ArrayEquals(pack.extraFields!, packet.extraFields!)
        )

        if (existingPacket) {
            if (findIndex(existingPacket.positions, pos => block.pos.x === pos.x && block.pos.y === pos.y) === -1) {
                existingPacket.positions.push(block.pos);
            }
        } else list.push(packet);
    }
    
    return list;
}