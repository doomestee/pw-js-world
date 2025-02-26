// I cba so all of the typings will go here

import Block from "../Block.js";
import Player, { IPlayerEffect, IPlayerRights } from "../Player.js";

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

export type PWGameHook = {
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
    playerCounterTransactionPacket: { player: Player, oldScore: number, diff: number }
};