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
  maxSupportCards: number;
  maxSameNamedAttackCards: number;
  maxSameNamedSupportCards: number;
};

export const GAME_RULES: Readonly<GameRules> = {
  version: "ruleset-v1",
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
  minAttackCards: 10,
  maxSupportCards: 7,
  maxSameNamedAttackCards: 2,
  maxSameNamedSupportCards: 2,
};
