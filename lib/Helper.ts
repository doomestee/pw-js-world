import { BlockNames, type CustomBotEvents, Hook, PWGameClient } from "pw-js-api";

import type { WorldMeta } from "../node_modules/pw-js-api/dist/gen/world_pb";
import Block from "./Block";
import BufferReader from "./BufferReader";
import Player, { IPlayerEffect, IPlayerRights, PlayerEffect } from "./Player";
import { LayerType } from "./Constants";
import type { BlockArg, Point, SendableBlockPacket } from "./types";

/**
 * To use this helper, you must first create an instance of this,
 * 
 * then: <PWGameClient>.addCallback("raw", helper.onRawPacketRecv)
 */
export default class PWGameWorldHelper {
    /**
     * Arrays of blocks (by layer, x, y)
     */
    blocks: [Block[][], Block[][]] = [[], []];//Block[][][] = [];

    players = new Map<number, Player>();

    globalSwitches:boolean[] = [];

    private _meta?: WorldMeta | null;
    private _width = 0;
    private _height = 0;
    private _init = false;
    private _selfPlayerId = -1;

    /**
     * The current world's width.
     * 
     * If you didn't put the hook before init, this may throw error.
     */
    get width() {
        if (this._width === -1) throw Error("World not initialised, or was applied too late.");
        return this._width;
    }
    
    /**
     * The current world's height.
     * 
     * If you didn't put the hook before init, this may throw error.
     */
    get height() {
        if (this._height === -1) throw Error("World not initialised, or was applied too late.");
        return this._height;
    }

    /**
     * The current world's metadata.
     * 
     * If you didn't put the hook before init, this may throw error.
     */
    get meta() {
        if (this._meta === undefined) throw Error("World not initialised, or was applied too late.");
        return this._meta;
    }

    /**
     * If this helper is ready. When it's false, the helper will not return anything for any of the packets.
     */
    get initialised() {
        return this._init;
    }

    /**
     * The bot's player object.
     * 
     * If you didn't put the hook before init, this may throw error.
     */
    get botPlayer() {
        let player = this.players.get(this._selfPlayerId);

        if (!player) throw Error("Player not stored, hook may have been applied too late?");
        return player;
    }

    /**
     * The bot's player id in the world.
     * 
     * If you didn't put the hook before init, this may throw error.
     */
    get botPlayerId() {
        if (this._selfPlayerId === -1) throw Error("Player not stored, hook may have been applied too late.");

        return this._selfPlayerId;
    }

    /**
     * This must go in .use() of the main PW-JS-API Game Client class.
     * 
     * <PWGameClient>.use(<PWGameWorldHelper>.receiveHook)
     * 
     * DO NOT PUT () AFTER RECEIVEHOOK
     */
    receiveHook: Hook<{
            worldBlockPlacedPacket: { player: Player, oldBlocks: Block[], newBlocks: Block[] },
            playerJoinedPacket: { player: Player },
            playerLeftPacket: { player: Player },
            playerInitPacket: { player: Player },
            playerFacePacket: { player: Player, oldFace: number },
            playerModModePacket: { player: Player, oldState: boolean },
            playerGodModePacket: { player: Player, oldState: boolean },
            playerAddEffectPacket: { player: Player, effect: IPlayerEffect },
            playerRemoveEffectPacket: { player: Player, effect: IPlayerEffect },
            playerResetEffectsPacket: { player: Player, effects: IPlayerEffect[] },
            playerMovedPacket: { player: Player },
            playerResetPacket: { player: Player },
            playerRespawnPacket: { player: Player },
            playerUpdateRightsPacket: { player: Player, rights: IPlayerRights },
            playerTeamUpdatePacket: { player: Player, oldTeam: number },
            playerCountersUpdatePacket: { player: Player, oldState: { coinsBlue: number, coinsGold: number, deaths: number } },
            playerTeleportedPacket: { player: Player },
            globalSwitchChangedPacket: { player: Player },
            globalSwitchResetPacket: { player: Player },
            playerLocalSwitchChangedPacket: { player: Player },
            playerLocalSwitchResetPacket: { player: Player },
            playerChatPacket: { player: Player },
            playerDirectMessagePacket: { player: Player },
            playerTouchBlockPacket: { player: Player },
        }> = 
        (data: CustomBotEvents["raw"]) => {

        const { packet } = data;

        switch (packet.case) {
            //#region World
            case "playerInitPacket":
                {
                    this._height = packet.value.worldHeight;
                    this._width = packet.value.worldWidth;
                    this._meta = packet.value.worldMeta ?? null;

                    this.initialise(packet.value.worldData);

                    const props = packet.value.playerProperties;

                    this.globalSwitches = this.convertSwitchState(packet.value.globalSwitchState);

                    if (props) {
                        this.players.set(props.playerId, new Player(props, true));
                        this._selfPlayerId = props.playerId;

                        return { player: this.players.get(props.playerId) };
                    }//packet.value..playerProperties?.)
                    return;
                }
            case "worldMetaUpdatePacket":
                this._meta = packet.value.meta ?? null;
                return;
            case "worldReloadedPacket":
                this.initialise(packet.value.worldData);
                return;
            case "worldClearedPacket":
                this.clear();
                return;
            case "worldBlockPlacedPacket":
                {
                    if (!this._init) return;

                    const { positions, layer, blockId, extraFields, playerId } = packet.value;

                    const player = this.players.get(playerId as number);

                    const oldBlocks:Block[] = [];
                    const newBlocks:Block[] = [];

                    const args = Block.deserializeArgs(blockId, BufferReader.from(extraFields), true);

                    for (let i = 0, len = positions.length; i < len; i++) {
                        const { x, y } = positions[i];

                        oldBlocks[i] = this.blocks[layer][x][y].clone();
                        newBlocks[i] = this.blocks[layer][x][y] = new Block(blockId, args)
                    }

                    if (!player) return;

                    return { player, oldBlocks, newBlocks };
                }
            //#endregion
            //#region Player
            case "playerJoinedPacket":
                {
                    const { properties, worldState } = packet.value;

                    let player: Player;

                    if (properties && worldState) {
                        this.players.set(properties.playerId, player = new Player(properties, { ...worldState, switches: this.convertSwitchState(worldState.switches) }));
                        
                        return { player };
                    }
                }
                return;
            case "playerLeftPacket":
                {
                    const player = this.players.get(packet.value.playerId);

                    if (player) {
                        this.players.delete(packet.value.playerId);

                        return { player: player };
                    }
                }
                return;
            case "playerFacePacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        const oldie = player.face;

                        player.face = packet.value.faceId;

                        return { player, oldFace: oldie };//changes: { type: "face", oldValue: oldFace, newValue: player.face } };
                    }
                }
                return;
            case "playerModModePacket": case "playerGodModePacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        const state = packet.case === "playerGodModePacket" ? "godmode" : "modmode";

                        const oldie = player.states[state];

                        player.states[state] = packet.value.enabled;

                        return { player, oldState: oldie };//changes: { type: "face", oldValue: oldFace, newValue: player.face } };
                    }
                }
                return;
            case "playerAddEffectPacket": case "playerRemoveEffectPacket": case "playerResetEffectsPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        // const state = //packet.case === "playerGodModePacket" ? "godmode" : "modmode";

                        let effects:PlayerEffect[] = [];

                        if (packet.case === "playerAddEffectPacket") {
                            const eff = {
                                effectId: packet.value.effectId,
                                duration: packet.value.duration,
                                strength: packet.value.strength,
                            };

                            player.effects.push(new PlayerEffect(eff));

                            return { player, effect: eff };
                        } else if (packet.case === "playerRemoveEffectPacket") {
                            const eff = player.effects.findIndex(v => v.effectId === packet.value.effectId);

                            if (eff) {
                                effects = player.effects.splice(eff, 1);

                                return { player, effect: effects[0] };
                            }
                        } else {
                            return { player, effects: player.effects.splice(0) };
                        }
                    }
                }
                return;
            case "playerMovedPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        if (packet.value.position) {
                            player.position = {
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            };
                        }

                        return { player };//changes: { type: "face", oldValue: oldFace, newValue: player.face } };
                    }
                }
                return;
            case "playerResetPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        player.resetState();

                        if (packet.value.position) {
                            player.position = {
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            }
                        }
                        
                        return { player }
                    }
                }
                return;
            case "playerRespawnPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) { // deaths also reflect in counters update packet
                        if (packet.value.position) {
                            player.position = {
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            }
                        }
                        
                        return { player }
                    }
                }
                return;
            case "playerUpdateRightsPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        if (packet.value.rights) {
                            player.rights = {
                                availableCommands: packet.value.rights.availableCommands,
                                canChangeWorldSettings: packet.value.rights.canChangeWorldSettings,
                                canEdit: packet.value.rights.canEdit,
                                canGod: packet.value.rights.canGod,
                                canToggleMinimap: packet.value.rights.canToggleMinimap,
                            }
                        } else player.resetRights();
                        
                        return { player, rights: player.rights }
                    }
                }
                return;
            case "playerTeamUpdatePacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        const oldTeam = player.states.teamId;
                        player.states.teamId = packet.value.teamId;

                        return { player, oldTeam };
                    }
                }
                return;
            case "playerCountersUpdatePacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        const oldState = {
                            coinsBlue: player.states.coinsBlue,
                            coinsGold: player.states.coinsGold,
                            deaths: player.states.deaths,
                        }

                        player.states.coinsBlue = packet.value.blueCoins;
                        player.states.coinsGold = packet.value.coins;
                        player.states.deaths = packet.value.deaths;

                        return { player, oldState };
                    }
                }
                return;
            case "playerTeleportedPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        if (packet.value.position)
                            player.position = {
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            }

                        return { player };
                    }
                }
                return;
            case "globalSwitchChangedPacket": case "playerLocalSwitchChangedPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (packet.case === "globalSwitchChangedPacket") {
                        this.globalSwitches[packet.value.switchId] = packet.value.enabled;
                    }

                    if (player) {
                        if (packet.case === "playerLocalSwitchChangedPacket") {
                            player.states.switches[packet.value.switchId] = packet.value.switchEnabled;
                        }

                        return { player };
                    }
                }
                return;
            case "globalSwitchResetPacket": case "playerLocalSwitchResetPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (packet.case === "globalSwitchResetPacket") {
                        this.globalSwitches = this.globalSwitches.fill(false);
                    }

                    if (player) {
                        if (packet.case === "playerLocalSwitchResetPacket") {
                            if (packet.value.switchId === undefined) player.states.switches.fill(false);
                            else player.states.switches[packet.value.switchId] = packet.value.switchEnabled;
                        }

                        return { player };
                    }
                }
                return;
            case "playerChatPacket": case "playerDirectMessagePacket":
            // case "playerDirectMessagePacket":
                {
                    const player = this.players.get(packet.case === "playerChatPacket" ? packet.value?.playerId as number : (packet.value.fromPlayerId === this._selfPlayerId ? packet.value.fromPlayerId : packet.value.targetPlayerId));

                    if (player) {
                        return { player };
                    }
                }
                return;
            case "playerTouchBlockPacket":
                {
                    const player = this.players.get(packet.value.playerId as number);

                    if (player && packet.value.position) {
                        const blockName = BlockNames[packet.value.blockId];

                        if (blockName === "COIN_GOLD" || blockName === "COIN_BLUE") {
                            player.states.collectedItems.push({
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            });
                        }
                    }

                    return player ? { player } : {};
                }
            //#endregion
        }

        return;
    }

    /**
     * Internal function.
     */
    private initialise(bytes: Uint8Array, width?: number, height?: number) {
        if (width === undefined) width = this.width;
        if (height === undefined) height = this.height;

        this.blocks.splice(0);

        for (let l = 0; l < 2; l++) {
            this.blocks[l] = [];
            for (let x = 0; x < width; x++) {
                this.blocks[l][x] = [];

                for (let y = 0; y < height; y++) {
                    this.blocks[l][x][y] = new Block(0);
                }
            }
        }

        this.deserialize(bytes);
    }

    /**
     * Internal function.
     */
    private deserialize(bytes: Uint8Array | Buffer | BufferReader) {
        const reader = bytes instanceof BufferReader ? bytes : BufferReader.from(bytes);

        for (let l = 0; l < 2; l++) {
            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    this.blocks[l][x][y] = Block.deserialize(reader);
                }
            }
        }

        this._init = true;
    }

    private convertSwitchState(arr: Uint8Array) {
        const list = new Array<boolean>(1000);

        for (let i = 0; i < 1000; i++) {
            list[i] = arr[i] === 1;
        }

        return list;
    }

    /**
     * Internal function, this triggers when the world gets cleared.
     * 
     * Clears the blocks map and promptly fill it with empty except the border which becomes basci gray.
     */
    private clear() {
        this.blocks.splice(0);

        // To prevent subtracting every single time, can be costly computation wise.
        const lastWidth = this.width - 1;
        const lastHeight = this.width - 1;

        for (let l = 0; l < 2; l++) {
            this.blocks[l] = [];

            for (let x = 0; x < this.width; x++) {
                this.blocks[l][x] = [];

                for (let y = 0; y < this.height; y++) {                    
                    this.blocks[l][x][y] = new Block(l === 1 && (x === 0 || x === lastWidth || y === 0 || y === lastHeight) ? "BASIC_GRAY" : "EMPTY");
                }
            }
        }
    }

    /**
     * Gets the block at the position.
     */
    getBlockAt(x: number, y: number, l: number) {
        return this.blocks[l][x][y];
    }

    /**
     * Player ID.
     * 
     * The main bot player is excluded from the criteria.
     */
    getPlayer(id: number, isAccount?: false) : Player | undefined;
    /**
     * Username is case insensitive.
     * 
     * The main bot player is excluded from the criteria.
     */
    getPlayer(username: string, isAccount?: false) : Player | undefined;
    /**
     * The ID of the account (must have second parameter set to true)
     * 
     * The main bot player is excluded from the criteria.
     */
    getPlayer(accountId: string, isAccount: true) : Player | undefined;
    getPlayer(id: string | number, isAccount?: boolean) : Player | undefined {
        if (typeof id === "string") {
            const players = this.getPlayers();
            // all names are upper case
            if (!isAccount) id = id.toUpperCase();

            for (let i = 0, len = players.length; i < len; i++) {
                if (isAccount) {
                    if (players[i].accountId === id) return players[i];
                } else if (players[i].username === id) return players[i];
            }

            return undefined;
        }

        return this.players.get(id);
    }

    /**
     * Returns the list of current players in the world.
     */
    getPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * For now this is slightly limited, but this will ONLY create a sendable packet which you must then send it yourself.
     */
    createBlockPacket(blockId: number | BlockNames | keyof typeof BlockNames, layer: LayerType, pos: Point | Point[], ...args: BlockArg[]) : SendableBlockPacket;
    createBlockPacket(block: Block, layer: LayerType, pos: Point | Point[]) : SendableBlockPacket;
    createBlockPacket(blockId: number | BlockNames | keyof typeof BlockNames | Block, layer: LayerType, pos: Point | Point[], ...args: BlockArg[]) {
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
}