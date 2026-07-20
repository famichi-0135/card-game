import type { DeepReadonly } from "./deep-readonly.js";
import type { CardEffectDefinition } from "./effect-definition.js";
import type { CardCatalogVersion, CardDefinitionId } from "./identifiers.js";

export type Attribute = "attributeA" | "attributeB" | "attributeC";

export type BaseCardDefinition = {
  id: CardDefinitionId;
  name: string;
  attribute: Attribute;
  cardType: "mana" | "attack" | "support";
};

export type ManaCardDefinition = BaseCardDefinition & {
  cardType: "mana";
  manaAmount: 1;
};

export type AttackCardDefinition = BaseCardDefinition & {
  cardType: "attack";
  cost: number;
  basePower: number;
  chainableCardIds: CardDefinitionId[];
  effects: CardEffectDefinition[];
};

export type SupportDuration = "instant" | "untilRoundEnd" | "permanent";

export type SupportCardDefinition = BaseCardDefinition & {
  cardType: "support";
  cost: number;
  duration: SupportDuration;
  effects: CardEffectDefinition[];
};

export type CardDefinition =
  | ManaCardDefinition
  | AttackCardDefinition
  | SupportCardDefinition;

export type CardCatalog = {
  readonly version: CardCatalogVersion;
  readonly definitions: Readonly<
    Record<CardDefinitionId, DeepReadonly<CardDefinition>>
  >;
};
