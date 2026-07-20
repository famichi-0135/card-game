import type { EffectId } from "./identifiers.js";
import type { JsonObject } from "./json.js";
import type { TargetRule } from "./effect-target.js";

export type EffectActivationType = "onPlay" | "continuous";
export type PowerScope = "cardPower" | "groupPower" | "totalPower";
export type PowerOperation = "overwrite" | "add" | "multiply";

export type BaseEffectDefinition = {
  effectId: EffectId;
  activationType: EffectActivationType;
  targetRule: TargetRule;
};

export type ModifyPowerEffectDefinition = BaseEffectDefinition & {
  type: "modifyPower";
  scope: PowerScope;
  operation: PowerOperation;
  value: number;
};

export type ChangeStaminaEffectDefinition = BaseEffectDefinition & {
  type: "changeStamina";
  amount: number;
};

export type ReduceManaEffectDefinition = BaseEffectDefinition & {
  type: "reduceMana";
  amount: number;
};

export type DrawCardsEffectDefinition = BaseEffectDefinition & {
  type: "drawCards";
  count: number;
};

export type RemoveAttackGroupEffectDefinition = BaseEffectDefinition & {
  type: "removeAttackGroup";
};

export type RemoveSupportCardEffectDefinition = BaseEffectDefinition & {
  type: "removeSupportCard";
};

export type CustomEffectDefinition = BaseEffectDefinition & {
  type: "custom";
  handlerId: string;
  config: JsonObject;
};

export type CardEffectDefinition =
  | ModifyPowerEffectDefinition
  | ChangeStaminaEffectDefinition
  | ReduceManaEffectDefinition
  | DrawCardsEffectDefinition
  | RemoveAttackGroupEffectDefinition
  | RemoveSupportCardEffectDefinition
  | CustomEffectDefinition;
