// I cba so all of the typings will go here

type Point = { x: number, y: number };

export interface SendableBlockPacket {
    /**
     * If true, just leave one position
     */
    isFillOperation: boolean;
    blockId: number;
    layer: number;
    /**
     * Note: (I THINK) 250 positions limit.
     */
    positions: Point[];
    extraFields?: Uint8Array;
}

export type BlockArg = (string | number | bigint | boolean | Buffer);