import type { CardCatalog } from "./card-definition.js";
import type { EffectRegistry } from "./effects.js";
import type { EngineSemanticsVersion } from "./identifiers.js";
import type { GameRules } from "./rules.js";

export type GameEngineContext = {
  rules: Readonly<GameRules>;
  cardCatalog: CardCatalog;
  effectRegistry: Readonly<EffectRegistry>;
  engineSemanticsVersion: EngineSemanticsVersion;
};
