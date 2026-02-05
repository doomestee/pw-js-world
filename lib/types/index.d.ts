// I cba so all of the typings will go here

import type { CleanProtoMessage, OmitRecursively, ProtoGen } from "pw-js-api";
import Player, { IPlayerRights, PlayerEffect } from "../Player.js";
import Block from "../Block.js";
import Label from "../Label.js";

type Point = { x: number, y: number };

export interface SendableBlockPacket {
    blockId: number;
    layer: number;
    /**
     * Note: (I THINK) 250 positions limit.
     */
    positions: Point[];
    fields: CleanProtoMessage<ProtoGen.WorldBlockPlacedPacket["fields"]>
}

export type BlockArg = (string | number | boolean | Uint8Array | undefined);

type PlayerObj = { player: Player };

export type PWGameHook = {
    worldBlockPlacedPacket: PlayerObj & { oldBlocks: Block[], newBlocks: Block[] },
    playerJoinedPacket: PlayerObj,
    playerLeftPacket: PlayerObj,
    playerInitPacket: PlayerObj,
    playerSmileyPacket: PlayerObj & { oldSmiley: number },
    playerAuraPacket: PlayerObj & { oldAura: number },
    playerModModePacket: PlayerObj & { oldState: boolean },
    playerGodModePacket: PlayerObj & { oldState: boolean },
    playerAddEffectPacket: PlayerObj & { effect: PlayerEffect },
    playerRemoveEffectPacket: PlayerObj & { effect: PlayerEffect },
    playerResetEffectsPacket: PlayerObj & { effects: PlayerEffect[] },
    playerMovedPacket: PlayerObj,
    playerResetPacket: PlayerObj,
    playerRespawnPacket: PlayerObj,
    playerUpdateRightsPacket: PlayerObj & { rights: IPlayerRights },
    playerTeamUpdatePacket: PlayerObj & { oldTeam: number },
    playerCountersUpdatePacket: PlayerObj & { oldState: { coins: { blue: number, gold: number }, deaths: number } },
    playerTeleportedPacket: PlayerObj,
    globalSwitchChangedPacket: PlayerObj,
    globalSwitchResetPacket: PlayerObj,
    playerLocalSwitchChangedPacket: PlayerObj,
    playerLocalSwitchResetPacket: PlayerObj,
    playerChatPacket: PlayerObj,
    playerDirectMessagePacket: PlayerObj,
    playerTouchBlockPacket: PlayerObj,
    playerCounterTransactionPacket: PlayerObj & { oldScore: number, diff: number },
    worldLabelUpsertPacket: { label: Label, oldLabel: Label | null },
    worldLabelDeletePacket: { labelId: string, oldLabel: Label | null },
};