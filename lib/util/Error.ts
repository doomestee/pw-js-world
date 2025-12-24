import type { AnyBlockField } from "pw-js-api";

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

export class LegacyIncorrectArgsLenError extends Error {
    constructor(msg: string,
        /**
         * The offending block ID.
         */
        public blockId: number | string,
        /**
         * The current number of args for this block.
         */
        public currArgsLen: number,
        /**
         * The expected number of args for this block.
         */
        public expectedArgsLen: number
        ) {
        super(msg);
    }
}

export class LegacyIncorrectArgError extends Error {
    constructor(msg: string,
        /**
         * The offending block ID.
         */
        public blockId: number | string,
        /**
         * The violating arg.
         */
        public arg: any,
        /**
         * The expected field.
         */
        public field: AnyBlockField
        ) {
        super(msg);
    }
}