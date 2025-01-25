import type { ProtoGen } from "pw-js-api";
import type { Point } from "./types/index.js";

export interface IPlayer {
    /**
     * ID of the player.
     */
    playerId: number;
    /**
     * ID of the player's account.
     */
    accountId: string;
    /**
     * Name of the player.
     */
    username: string;
    /**
     * ID of the player's equipped smiley.
     */
    face: number;
    /**
     * String, could be an admin or developer.
     */
    role: string;
    /**
     * If player is bot user's friend.
     */
    isFriend: boolean;
    /**
     * Position of the user.
     * 
     * Note: This helper does not simulate physics so positions will always be inaccurate.
     */
    position?: Point;
    /**
     * If player is the world owner.
     */
    isWorldOwner: boolean;
    /**
     * Rights
     */
    rights: IPlayerRights;
    /**
     * current world state.
     */
    states: IPlayerWorldState;

    /**
     * List of active effects the player has.
     */
    effects: PlayerEffect[];

    /**
     * If this player is the bot.
     */
    isMe: boolean;
}

export interface IPlayerRights {
    /**
     * If the player has edit rights.
     */
    canEdit: boolean;
    /**
     * If the player has god rights.
     */
    canGod: boolean;
    /**
     * If the player has the ability to toggle minimap.
     */
    canToggleMinimap: boolean;
    /**
     * If the player has the ability to change the world settings.
     */
    canChangeWorldSettings: boolean;
    /**
     * List of commands (string) the player can use.
     */
    availableCommands: string[];
}

export interface IPlayerWorldState {
    /**
     * Number of gold coins the player has.
     */
    coinsGold: number;
    /**
     * Number of blue coins the player has.
     */
    coinsBlue: number;
    /**
     * Number of times the player died.
     */
    deaths: number;
    /**
     * Coordinates of collected coins?
     */
    collectedItems: Point[];
    /**
     * If player has gold crown on.
     */
    hasGoldCrown: boolean;
    /**
     * If player has won the world.
     */
    hasSilverCrown: boolean;
    /**
     * Zero indexed, map of the player's switch state.
     */
    switches: boolean[];
    /**
     * If player is in god mode right now.
     */
    godmode: boolean;
    /**
     * If player is in mod mode right now.
     */
    modmode: boolean;
    /**
     * ID of the team the player is associated with right now.
     */
    teamId: number;
}

export interface IPlayerEffect {
    /**
     * The ID of the effect.
     */
    effectId: number;
    /**
     * If applicable, the duration of the effect.
     */
    duration?: number;
    /**
     * If applicable, the strength of the effect. (For example speed or multi jump effect)
     */
    strength?: number;
}

export default class Player {
    /**
     * ID of the player.
     */
    playerId: number;
    /**
     * ID of the player's account.
     */
    accountId: string;
    /**
     * Name of the player.
     */
    username: string;
    /**
     * ID of the player's equipped smiley.
     */
    face: number;
    /**
     * String, could be an admin or developer.
     */
    role: string;
    /**
     * If player is bot user's friend.
     */
    isFriend: boolean;
    /**
     * Position of the user.
     * 
     * Note: This helper does not simulate physics so positions will always be inaccurate.
     */
    position?: Point;
    /**
     * If player is the world owner.
     */
    isWorldOwner: boolean;
    /**
     * Rights
     */
    rights!: IPlayerRights;
    /**
     * current world state.
     */
    states!: IPlayerWorldState;

    /**
     * List of active effects the player has.
     */
    effects:PlayerEffect[] = [];

    /**
     * If this player is the bot.
     */
    isMe: boolean = false;

    constructor(props: ProtoGen.PlayerProperties, states?: IPlayerWorldState | boolean) {
        this.accountId = props.accountId;
        this.face = props.face;
        this.isFriend = props.isFriend;
        this.isWorldOwner = props.isWorldOwner;
        this.playerId = props.playerId;
        this.position = props.position ? {
            x: props.position.x,
            y: props.position.y
        } : undefined;

        if (!props.rights) this.resetRights();
        else this.rights = {
            availableCommands: props.rights.availableCommands,
            canChangeWorldSettings: props.rights.canChangeWorldSettings,
            canEdit: props.rights.canEdit,
            canGod: props.rights.canGod,
            canToggleMinimap: props.rights.canToggleMinimap,
        };

        this.role = props.role;
        this.username = props.username;

        if (typeof states === "boolean") {
            this.isMe = states;
            states = undefined;
        }

        if (!states) {
            // Could be bot via init that don't get states.
            this.resetState()
        } else this.states = {
            coinsBlue: states.coinsBlue,
            coinsGold: states.coinsGold,
            collectedItems: states.collectedItems.map(v => ({ x: v.x, y: v.y })),
            deaths: states.deaths,
            godmode: states.godmode,
            hasGoldCrown: states.hasGoldCrown,
            hasSilverCrown: states.hasSilverCrown,
            modmode: states.modmode,
            switches: states.switches,
            teamId: states.teamId,
        };
    }

    /**
     * This is destructive, this is only for on reset packet.
     */
    resetState() {
        this.states = {
            coinsBlue: 0,
            coinsGold: 0,
            collectedItems: [],
            deaths: 0,
            godmode: false,
            hasGoldCrown: false,
            hasSilverCrown: false,
            modmode: false,
            switches: new Array(1000).fill(false),
            teamId: 0,
        }
    }

    /**
     * Destructive.
     */
    resetRights() {
        this.rights = {
            availableCommands: [],
            canChangeWorldSettings: false,
            canEdit: false,
            canGod: false,
            canToggleMinimap: false
        }
    }
}

export class PlayerEffect {
    /**
     * The ID of the effect.
     */
    effectId: number;
    /**
     * If applicable, the duration of the effect.
     */
    duration?: number;
    /**
     * If applicable, the strength of the effect. (For example speed or multi jump effect)
     */
    strength?: number;
    /**
     * The time the effect occurred.
     */
    triggeredAt: number;

    constructor(effect: IPlayerEffect, triggeredAt?: number) {
        this.effectId = effect.effectId;
        this.duration = effect.duration;
        this.strength = effect.strength;

        this.triggeredAt = triggeredAt ?? Date.now();
    }


    /**
     * Note: If this effect is non timed, this will always return false.
     */
    get hasExpired() {
        if (this.duration === undefined) return false;

        return Date.now() > (this.triggeredAt + this.duration);
    }

    /**
     * Milliseconds showing how long before this expires.
     * 
     * Note: If this effect is non timed, this will return infinity.
     */
    get remaining() {
        if (this.duration === undefined) return Infinity;

        return Math.max(0, Date.now() - (this.triggeredAt + this.duration));
    }
}