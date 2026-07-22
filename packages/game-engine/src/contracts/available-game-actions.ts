import type { EffectTarget } from "./effect-target.js";
import type {
  AttackGroupId,
  CardDefinitionId,
  CardInstanceId,
  EffectId,
} from "./identifiers.js";
import type { AttackGroupSlotIndex } from "./game-state.js";
import type { PublicCardCatalog } from "./public-card-catalog.js";
import type { PlayerGameView } from "./views.js";

/** クライアントへ返す、操作できない理由の安定した識別子。 */
export type GameActionUnavailableReasonCode =
  | "GAME_NOT_ACTIVE"
  | "CARD_CATALOG_VERSION_MISMATCH"
  | "CARD_DEFINITION_NOT_FOUND"
  | "PHASE_DEADLINE_EXPIRED"
  | "INVALID_PHASE"
  | "NOT_CURRENT_PLAYER"
  | "INVALID_CARD_TYPE"
  | "ATTACK_GROUP_LIMIT_REACHED"
  | "ATTACK_GROUP_SLOT_UNAVAILABLE"
  | "INSUFFICIENT_MANA"
  | "CHAIN_NOT_ALLOWED"
  | "SUPPORT_ALREADY_FINISHED"
  | "EFFECT_TARGET_UNAVAILABLE";

export type AvailableAction =
  | { available: true }
  | { available: false; unavailableReason: GameActionUnavailableReasonCode };

export type AvailableAttackPlacement = AvailableAction & {
  slotIndices: AttackGroupSlotIndex[];
};

export type AvailableAttackChain = AvailableAction & {
  targetGroupIds: AttackGroupId[];
};

export type AvailableSupportEffectSelection = {
  effectId: EffectId;
  stageIndex: number;
  required: boolean;
  minTargets: number;
  maxTargets: number;
  selectionOrder: "independent";
  candidates: EffectTarget[];
};

export type AvailableSupportPlay = AvailableAction & {
  effectSelections: AvailableSupportEffectSelection[];
};

/** 手札の各カードについて、現在の公開状態から導出できる操作候補。 */
export type AvailableHandCardActions = {
  cardInstanceId: CardInstanceId;
  definitionId: CardDefinitionId;
  placeAttack: AvailableAttackPlacement;
  chainAttack: AvailableAttackChain;
  discard: AvailableAction;
  playSupport: AvailableSupportPlay;
};

export type AvailableGameActions = {
  stateVersion: number;
  phaseSequence: number;
  handCards: Record<CardInstanceId, AvailableHandCardActions>;
  finishPlacement: AvailableAction;
  finishSupport: AvailableAction;
};

export type GetAvailableGameActionsInput = {
  view: PlayerGameView;
  catalog: PublicCardCatalog;
  now: number;
};
