import { PWApiClient, type CustomBotEvents, type Hook } from "pw-js-api";
import type { ProtoGen } from "pw-js-api";//"../node_modules/pw-js-api/dist/gen/world_pb";

import Block from "./Block.js";
import Label from "./Label.js";

import Player, { PlayerCounters, PlayerEffect } from "./Player.js";

import { EffectId, LayerType } from "./Constants.js";
import type { Point, PWGameHook } from "./types/index.js";
import { DeserialisedStructure } from "./Structure.js";
import { MissingBlockError } from "./util/Error.js";
import { read7BitEncodedInt } from "./util/Misc.js";
import { KeyStates, updateKeyStates } from "./KeyState.js";

/**
 * To use this helper, you must first create an instance of this,
 * 
 * then: <PWGameClient>.addCallback("raw", helper.onRawPacketRecv)
 */
export default class PWGameWorldHelper {
    /**
     * Arrays of blocks (by layer, x, y)
     */
    blocks: [Block[][], Block[][], Block[][]] = [[], [], []];//Block[][][] = [];

    labels: Map<string, Label> = new Map();

    players = new Map<number, Player>();

    globalSwitches:boolean[] = [];

    // Due to insufficient information received from game server, there is no way to distinguish whether:
    // - left and right keys are both held, or both not held
    // - up and down keys are both held, or both not held
    keyStates: KeyStates = {
        up: { pressed: false, released: false, held: false },
        down: { pressed: false, released: false, held: false },
        left: { pressed: false, released: false, held: false },
        right: { pressed: false, released: false, held: false },
        jump: { pressed: false, released: false, held: false },
    }

    private _meta?: ProtoGen.WorldMeta | null;
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
    receiveHook: Hook<PWGameHook> = 
        (data: CustomBotEvents["raw"]) => {

        const { packet } = data;

        switch (packet.case) {
            //#region World
            case "playerInitPacket":
                {
                    this._height = packet.value.worldHeight;
                    this._width = packet.value.worldWidth;
                    this._meta = packet.value.worldMeta ?? null;

                    this.initialise(packet.value);

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
                this.initialise(packet.value);
                return;
            case "worldClearedPacket":
                this.clear();
                return;
            case "worldBlockPlacedPacket":
                {
                    if (!this._init) return;

                    const { positions, layer, blockId, fields, playerId } = packet.value;

                    const player = this.players.get(playerId as number);

                    const oldBlocks:Block[] = [];
                    const newBlocks:Block[] = [];

                    for (let i = 0, len = positions.length; i < len; i++) {
                        const { x, y } = positions[i];

                        oldBlocks[i] = this.blocks[layer][x][y].clone();
                        newBlocks[i] = this.blocks[layer][x][y] = new Block(blockId)._initArgs(packet.value.fields);
                    }
                    
                    // console.log(`Block has been placed: ${blockId}, args:`, newBlocks[0].args);

                    if (!player) return;

                    return { player, oldBlocks, newBlocks };
                }
                // return;
            case "worldLabelUpsertPacket":
                {
                    if (!this._init) return;

                    const label = packet.value.label;

                    if (label) {
                        const l = new Label(label);

                        const oldLabel = this.labels.get(l.id) ?? null;
                        
                        this.labels.set(l.id, l);

                        return { label: l, oldLabel };
                    }

                    return {};
                }
            case "worldLabelDeletePacket":
                {
                    if (!this._init) return;

                    const labelId = packet.value.id;

                    const oldLabel = this.labels.get(labelId);

                    this.labels.delete(labelId);

                    return { labelId, oldLabel };
                }
            //#endregion
            //#region Player
            case "playerJoinedPacket":
                {
                    const { properties, worldState } = packet.value;

                    let player: Player;

                    if (properties && worldState) {
                        this.players.set(properties.playerId, player = new Player(properties, { ...worldState, switches: this.convertSwitchState(worldState.switches), counters: new PlayerCounters(worldState.counters) }));

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
            case "playerSmileyPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player) {
                        const oldie = player.smileyId;  

                        player.smileyId = packet.value.smileyId;

                        return { player, oldSmiley: oldie };//changes: { type: "face", oldValue: oldFace, newValue: player.face } };
                    }
                }
                return;
            case "playerAuraPacket":
                {
                    const player = this.players.get(packet.value.playerId as number);

                    if (player) {
                        const oldie = player.auraId;

                        player.auraId = packet.value.auraId;

                        return { player, oldAura: oldie };
                    }

                    return {};
                }
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
            case "playerAddEffectPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player === undefined) return;

                    const eff = new PlayerEffect({
                        effectId: packet.value.effectId,
                        duration: packet.value.duration,
                        strength: packet.value.strength,
                    });

                    // const prevEff = player.effects.get(eff.effectId);

                    // if (prevEff) {
                    //     // Cos mutability.
                    //     prevEff._update(eff);

                    //     return { player, effect: prevEff };
                    // }

                    if (eff.effectId === EffectId.Invulnerability) {
                        // maybe a better way to do this?
                        // TODO: return the affected effects?
                        player.effects.delete(EffectId.Curse);
                        player.effects.delete(EffectId.Zombie);
                        player.effects.delete(EffectId.Poison);
                    }

                    return { player, effect: eff };
                }
            case "playerRemoveEffectPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player === undefined) return;

                    const eff = player.effects.get(packet.value.effectId);

                    if (eff !== undefined) {
                        player.effects.delete(packet.value.effectId);

                        return { player, effect: eff };
                    }
                }
                return;
            case "playerResetEffectsPacket":
                {
                    const player = this.players.get(packet.value?.playerId as number);

                    if (player === undefined) return;

                    // const state = //packet.case === "playerGodModePacket" ? "godmode" : "modmode";
                    let effects:PlayerEffect[] = [];

                    const currEffects = Array.from(player.effects.values());

                    for (let i = 0; i < currEffects.length; i++) {
                        // for now its just curse/poison/zombie (all timed).
                        if (currEffects[i].duration !== undefined) continue;

                        effects.push(currEffects[i]);
                        player.effects.delete(currEffects[i].effectId);
                    }

                    return { player, effects: effects };
                }
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

                        updateKeyStates(this.keyStates, packet.value);

                        return { player, keyStates: this.keyStates };
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
                                canManageLabels: packet.value.rights.canToggleMinimap,
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
                            coins: {
                                blue: player.states.coins.blue,
                                gold: player.states.coins.gold,
                            },
                            deaths: player.states.deaths,
                        }

                        player.states.coins.blue = packet.value.blueCoins;
                        player.states.coins.gold = packet.value.coins;
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
                        this.globalSwitches[packet.value.switchId] = packet.value.switchEnabled;
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
                            player.states.switches.fill(packet.value.switchEnabled);
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
                        const blockName = PWApiClient.listBlocks?.[packet.value.blockId];

                        if (blockName === undefined) throw new MissingBlockError("Current block data might be outdated, restart application?", packet.value.blockId);

                        if (blockName.PaletteId === "COIN_GOLD" || blockName.PaletteId === "COIN_BLUE") {
                            player.states.collectedItems.push({
                                x: packet.value.position.x,
                                y: packet.value.position.y,
                            });
                        }
                    }

                    return player ? { player } : {};
                }
            case "playerCounterTransactionPacket":
                {
                    const player = this.players.get(packet.value.playerId as number);

                    if (player) {
                        const oldScore = player.states.counters.scores[packet.value.counterId];

                        player.states.counters.scores[packet.value.counterId] = packet.value.count;

                        return { oldScore, diff: packet.value.count - oldScore, player };
                    }

                    return {};
                }
            case "playerSetCollectiblesPacket":
                {
                    const player = this.players.get(packet.value.playerId as number);

                    if (!player) return {};

                    // not sure what to do?

                    // packet.value.collected
                    // console.log(packet.value.collected);
                    return;
                }
            //#endregion
        }

        return;
    }

    /**
     * Internal function.
     * 
     * Yes th typing is cursed, I don't care as this is private.
     */
    private initialise(bytes: Record<"backgroundLayerData"|"foregroundLayerData"|"overlayLayerData", Uint8Array<ArrayBufferLike>> & { blockDataPalette: ProtoGen.BlockDataInfo[], textLabels: ProtoGen.ProtoTextLabel[] }, width?: number, height?: number) {
        if (width === undefined) width = this.width;
        if (height === undefined) height = this.height;

        this.blocks.splice(0);
        this.labels.clear();

        for (let l = 0; l < 3; l++) {
            this.blocks[l] = [];
            for (let x = 0; x < width; x++) {
                this.blocks[l][x] = [];

                for (let y = 0; y < height; y++) {
                    this.blocks[l][x][y] = new Block(0);
                }
            }
        }

        for (let i = 0, len = bytes.textLabels.length; i < len; i++) {
            this.labels.set(bytes.textLabels[i].id, new Label(bytes.textLabels[i]));
        }

        this.deserialize(bytes);
    }

    /**
     * Internal function.
     */
    private deserialize(bytes: Record<"backgroundLayerData"|"foregroundLayerData"|"overlayLayerData", Uint8Array<ArrayBufferLike>> & { blockDataPalette: ProtoGen.BlockDataInfo[] }) {
        /**
         * Index based on the layer.
         * For now since there's only 3 layers.
         */
        const data = [
            bytes.backgroundLayerData,
            bytes.foregroundLayerData,
            bytes.overlayLayerData
        ];

        let palette: ProtoGen.BlockDataInfo;
        let runLength: number;
        let offset = {
            val: 0
        };

        for (let i = 0, l = 0; l < data.length; l++, i = 0) {
            offset.val = 0;

            while (data[l].byteLength - offset.val > 0) {
                palette = bytes.blockDataPalette[read7BitEncodedInt(data[l], offset)];
                runLength = (read7BitEncodedInt(data[l], offset));;

                const b = new Block(palette.blockId)._initArgs(palette.fields);

                while (runLength-- > 0) {
                    let x = Math.floor(i / this._height);
                    let y = i % this._height;

                    if (x < this._width && y < this._height) {
                        this.blocks[l][x][y] = b.clone();
                    }

                    i++;
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

        for (let l = 0; l < 3; l++) {
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
     * 
     * Difference between this and using this.blocks directly is that this function will validate the positions and the layer.
     */
    getBlockAt(pos: Point, l: LayerType) : Block;
    getBlockAt(x: number | Point, y: number, l: LayerType) : Block;
    getBlockAt(x: number | Point, y: number | LayerType, l?: LayerType) {
        if (typeof x !== "number") {
            l = y;
            y = x.y;
            x = x.x;
        }

        if (l === undefined || l < 0 || l > 2) throw Error("Unknown layer");

        if (x < 0 || x >= this.width) throw Error("X is outside the bound of the world.");
        if (y < 0 || y >= this.height) throw Error("Y is outside the bound of the world.");

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
     * This will return a DeserialisedStructure containing the blocks and labels. The structure can be saved to a file.
     * 
     * The blocks are cloned and thus you're free to modify the blocks in the structure without the risk of it affecting this helper's blocks.
     * 
     * NOTE: endX and endY are also included!
     */
    sectionArea(startX: number, startY: number, endX: number, endY: number) {
        const blocks: [Block[][], Block[][], Block[][]] = [[], [], []];
        const labels:Label[] = [];

        if (startX > endX) throw Error("Starting X is greater than ending X");
        if (startY > endY) throw Error("Starting Y is greater than ending Y");

        for (let l = 0; l < 3; l++) {
            for (let x = startX, width = Math.min(endX, this.width); x <= width; x++) {
                blocks[l][x - startX] = [];

                for (let y = startY, height = Math.min(endY, this.height); y <= height; y++) {
                    blocks[l][x - startX][y - startY] = this.blocks[l][x][y].clone();
                }
            }
        }

        if (this.labels.size) {
            for (const [, label] of this.labels) {
                let roundedPos = { x: Math.round(label.position.x / 16), y: Math.round(label.position.y / 16) }

                if (roundedPos.x >= startX && roundedPos.x <= endX
                    && roundedPos.y >= startY && roundedPos.y <= endY
                ) {
                    const labie = new Label(label);

                    labie.position.x -= (startX * 16);
                    labie.position.y -= (startY * 16);
                }
            }
        }

        return new DeserialisedStructure(blocks, { width: endX - startX + 1, height: endY - startY + 1 }, labels);
    }
}