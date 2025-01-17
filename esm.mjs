// TODO: clean this code to make it easier to get named exports.
let PWGameWorldHelper = (await import("./dist/Helper.js")).default;
let Block = (await import("./dist/Block.js")).default;
let BufferReader = (await import("./dist/BufferReader.js"));

let ComponentTypeHeader = BufferReader.ComponentTypeHeader;

BufferReader = BufferReader.default;

let Player = (await import("./dist/Player.js"));

let PlayerEffect = Player.PlayerEffect;

Player = Player.default;

if ("default" in PWGameWorldHelper) PWGameWorldHelper = PWGameWorldHelper.default;
if ("default" in Block) Block = Block.default;
if ("default" in BufferReader) BufferReader = BufferReader.default;
if ("default" in Player) Player = Player.default;

const Constants = (await import("./dist/Constants.js")).default;

export default {
    PWGameWorldHelper, Block, BufferReader,
    Player, Constants, ComponentTypeHeader,
    PlayerEffect
};

export {
    PWGameWorldHelper, Block, BufferReader,
    Player, Constants, ComponentTypeHeader,
    PlayerEffect
};