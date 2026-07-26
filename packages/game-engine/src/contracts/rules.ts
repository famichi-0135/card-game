import type { RulesetVersion } from "./identifiers.js";

export type GameRules = {
  version: RulesetVersion;
  playerCount: number;
  deckSize: number;
  initialStamina: number;
  initialDrawCount: number;
  handLimit: number;
  maxAttackGroups: number;
  placementTimeLimitMs: number;
  supportTimeLimitMs: number;
  maxRounds: number;
  minManaCards: number;
  maxManaCards: number;
  minAttackCards: number;
  maxAttackCards: number;
  maxSupportCards: number;
  maxSameNamedAttackCards: number;
  maxSameNamedSupportCards: number;
};

export type GameRulesValidationError = {
  code:
    | "UNSUPPORTED_PLAYER_COUNT"
    | "INVALID_INTEGER_VALUE"
    | "INVALID_RANGE"
    | "INVALID_DECK_COMPOSITION";
  field?: keyof GameRules;
  message: string;
};

export type GameRulesValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: GameRulesValidationError[];
    };

/** v3より前に開始され、コンテキストを持たない保存済み対戦の復元専用ルール。 */
export const LEGACY_V2_GAME_RULES: Readonly<GameRules> = {
  version: "ruleset-v2-factions",
  playerCount: 2,
  deckSize: 30,
  initialStamina: 25,
  initialDrawCount: 5,
  handLimit: 5,
  maxAttackGroups: 5,
  placementTimeLimitMs: 90_000,
  supportTimeLimitMs: 60_000,
  maxRounds: 30,
  minManaCards: 8,
  maxManaCards: 12,
  minAttackCards: 11,
  maxAttackCards: 30,
  maxSupportCards: 7,
  maxSameNamedAttackCards: 2,
  maxSameNamedSupportCards: 2,
};

export const GAME_RULES: Readonly<GameRules> = {
  version: "ruleset-v3-starter-balance",
  playerCount: 2,
  deckSize: 30,
  initialStamina: 25,
  initialDrawCount: 5,
  handLimit: 5,
  maxAttackGroups: 5,
  placementTimeLimitMs: 90_000,
  supportTimeLimitMs: 60_000,
  maxRounds: 30,
  minManaCards: 12,
  maxManaCards: 15,
  minAttackCards: 10,
  maxAttackCards: 15,
  maxSupportCards: 6,
  maxSameNamedAttackCards: 2,
  maxSameNamedSupportCards: 2,
};
