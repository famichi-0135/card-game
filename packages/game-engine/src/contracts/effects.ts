import type { Attribute, CardCatalog } from "./card-definition.js";
import type { DeepReadonly } from "./deep-readonly.js";
import type {
  CardEffectDefinition,
  PowerOperation,
  PowerScope,
} from "./effect-definition.js";
import type { EffectTarget } from "./effect-target.js";
import type {
  AttackGroupId,
  CardDefinitionId,
  CardInstanceId,
  EffectId,
  EffectInstanceId,
  PlayerId,
} from "./identifiers.js";
import type { JsonObject } from "./json.js";
import type { GameState } from "./game-state.js";
import type { GameRules } from "./rules.js";

export type EffectInput = {
  effectId: EffectId;
  targets: EffectTarget[];
  parameters?: JsonObject;
};

export type ActiveEffectDuration = "untilRoundEnd" | "whileSourceOnField";

export type ActiveEffect = {
  effectInstanceId: EffectInstanceId;
  effectId: EffectId;
  sourceCardInstanceId: CardInstanceId;
  ownerId: PlayerId;
  target: EffectTarget;
  scope: PowerScope;
  operation: PowerOperation;
  value: number;
  duration: ActiveEffectDuration;
  appliedSequence: number;
  appliedRound: number;
};

export type EffectContext = {
  state: DeepReadonly<GameState>;
  rules: Readonly<GameRules>;
  cardCatalog: CardCatalog;
  sourceCardInstanceId: CardInstanceId;
  sourceCardDefinitionId: CardDefinitionId;
  ownerId: PlayerId;
  input: DeepReadonly<EffectInput>;
  currentRound: number;
};

export type ActiveEffectDraft = Omit<
  ActiveEffect,
  "effectInstanceId" | "appliedSequence" | "appliedRound"
>;

export type EffectPlanOperation =
  | {
      type: "CHANGE_STAMINA";
      playerId: PlayerId;
      amount: number;
    }
  | {
      type: "REDUCE_MANA";
      playerId: PlayerId;
      attribute: Attribute;
      requestedAmount: number;
    }
  | {
      type: "DRAW_CARDS";
      playerId: PlayerId;
      count: number;
    }
  | {
      type: "REMOVE_ATTACK_GROUP";
      groupId: AttackGroupId;
    }
  | {
      type: "REMOVE_SUPPORT_CARD";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ADD_ACTIVE_EFFECT";
      effect: ActiveEffectDraft;
    };

export type EffectResolutionPlan = {
  readonly operations: readonly EffectPlanOperation[];
};

export type EffectValidationErrorCode =
  | "SOURCE_CARD_NOT_FOUND"
  | "SOURCE_CARD_NOT_ON_EXPECTED_ZONE"
  | "INVALID_ACTIVATION_TYPE"
  | "INVALID_EFFECT_INPUT"
  | "INVALID_TARGET_COUNT"
  | "INVALID_TARGET_TYPE"
  | "INVALID_TARGET_OWNER"
  | "TARGET_NOT_FOUND"
  | "TARGET_NO_LONGER_VALID"
  | "INSUFFICIENT_MANA"
  | "EFFECT_CONDITION_NOT_MET"
  | "EFFECT_CONFIG_INVALID"
  | "RESULTING_STATE_INVALID"
  | "EFFECT_HANDLER_NOT_FOUND"
  | "EFFECT_PLANNING_FAILED";

export type EffectValidationError = {
  code: EffectValidationErrorCode;
  message: string;
  details?: JsonObject;
};

export type EffectValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: EffectValidationError[];
    };

export interface CardEffectHandler {
  validateDefinition(
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectValidationResult;
  validate(
    context: EffectContext,
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectValidationResult;
  plan(
    context: EffectContext,
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectResolutionPlan;
}

export type EffectRegistry = Record<string, CardEffectHandler>;
