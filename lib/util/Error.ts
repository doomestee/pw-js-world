export class MissingBlockError extends Error {
    /**
     * The offending block ID.
     */
    public blockId: number | string;

    constructor(msg: string, blockId: number | string) {
        super(msg);
        this.blockId = blockId;
    }
}