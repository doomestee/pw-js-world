// TODO: clean this code to make it easier to get named exports.
let PWGameWorldHelper = (await import("./dist/Helper.js")).default;
let Block = (await import("./dist/Block.js")).default;
let BufferReader = (await import("./dist/BufferReader.js")).default;

let Player = (await import("./dist/Player.js"));

let PlayerEffect = Player.PlayerEffect;

Player = Player.default;

if ("default" in PWGameWorldHelper) PWGameWorldHelper = PWGameWorldHelper.default;
if ("default" in Block) Block = Block.default;
if ("default" in BufferReader) BufferReader = BufferReader.default;
if ("default" in Player) Player = Player.default;

import {LayerType} from "./dist/Constants.js";
import {ComponentTypeHeader} from "./dist/BufferReader.js";

export default {
    PWGameWorldHelper, Block, BufferReader,
    Player, LayerType, ComponentTypeHeader,
    PlayerEffect
};

export {
    PWGameWorldHelper, Block, BufferReader,
    Player, LayerType, ComponentTypeHeader,
    PlayerEffect
};