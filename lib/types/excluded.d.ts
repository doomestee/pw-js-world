// This will have the types that should not be exported to the library users, for eg cos they already exist in pw-js-api

import type { BlockNames } from "pw-js-api";

/**
 * Despite the name, it's called BlockKeys for the sake of conflict.
 * 
 * Self explanatory.
 */
export type BlockKeys = keyof typeof BlockNames;