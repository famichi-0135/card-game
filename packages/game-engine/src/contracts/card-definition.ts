import type { DeepReadonly } from "./deep-readonly.js";
import type { CardEffectDefinition } from "./effect-definition.js";
import type {
  CardCatalogVersion,
  CardDefinitionId,
  EffectId,
} from "./identifiers.js";
import type { JsonObject } from "./json.js";

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

export type CardCatalogInput = {
  version: CardCatalogVersion;
  definitions: CardDefinition[];
};

export type CardCatalogValidationError = {
  code:
    | "SCHEMA_VALIDATION_FAILED"
    | "DUPLICATE_CARD_ID"
    | "DUPLICATE_EFFECT_ID"
    | "CARD_REFERENCE_NOT_FOUND"
    | "HANDLER_NOT_FOUND"
    | "INVALID_LIFECYCLE_COMBINATION"
    | "INVALID_NUMERIC_VALUE"
    | "INVALID_TARGET_RULE"
    | "INVALID_CATALOG_VERSION";
  cardDefinitionId?: CardDefinitionId;
  effectId?: EffectId;
  message: string;
  details?: JsonObject;
};

export type CardCatalogValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: CardCatalogValidationError[];
    };

export type CreateCardCatalogResult =
  | {
      valid: true;
      catalog: CardCatalog;
    }
  | {
      valid: false;
      errors: CardCatalogValidationError[];
    };
