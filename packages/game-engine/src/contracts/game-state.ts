import type { Attribute, Faction, SupportDuration } from "./card-definition.js";
import type { ActiveEffect } from "./effects.js";
import type {
  AttackGroupId,
  CardCatalogVersion,
  CardDefinitionId,
  CardInstanceId,
  CommandId,
  EngineSemanticsVersion,
  GameId,
  PlayerId,
  RulesetVersion,
} from "./identifiers.js";
import type { GameWinner, RoundResult } from "./events.js";
import type { JsonObject } from "./json.js";

export type GameStatus = "initializing" | "active" | "finished";

export type GamePhase =
  | "initializing"
  | "firstPlayerPlacement"
  | "secondPlayerPlacement"
  | "support"
  | "resolution"
  | "cleanup"
  | "refill"
  | "finished";

export type CardInstance = {
  instanceId: CardInstanceId;
  definitionId: CardDefinitionId;
  ownerId: PlayerId;
};

export type AttackGroup = {
  groupId: AttackGroupId;
  ownerId: PlayerId;
  /** プレイヤーごとの盤面上の固定位置。 */
  slotIndex: AttackGroupSlotIndex;
  attribute: Attribute;
  cardIds: CardInstanceId[];
  createdRound: number;
};

/** 現行ルールの攻撃グループ盤面は5枠で固定する。 */
export const ATTACK_GROUP_SLOT_INDICES = [0, 1, 2, 3, 4] as const;
export type AttackGroupSlotIndex = (typeof ATTACK_GROUP_SLOT_INDICES)[number];

export type SupportCardOnField = {
  cardInstanceId: CardInstanceId;
  ownerId: PlayerId;
  playedRound: number;
  playedSequence: number;
  duration: SupportDuration;
};

export type BattlefieldState = {
  attackGroups: AttackGroup[];
  supportZone: SupportCardOnField[];
};

export type ManaState = Record<Attribute, { total: number }>;

export type CalculatedManaState = {
  total: number;
  reserved: number;
  available: number;
};

export type PlayerState = {
  playerId: PlayerId;
  faction: Faction;
  stamina: number;
  deck: CardInstanceId[];
  hand: CardInstanceId[];
  discardPile: CardInstanceId[];
  battlefield: BattlefieldState;
  mana: ManaState;
};

export type GameState = {
  gameId: GameId;
  initialRandomSeed: string;
  rulesetVersion: RulesetVersion;
  cardCatalogVersion: CardCatalogVersion;
  engineSemanticsVersion: EngineSemanticsVersion;
  stateVersion: number;
  status: GameStatus;
  round: number;
  phase: GamePhase;
  phaseSequence: number;
  phaseStartedAt: number;
  phaseDeadlineAt: number | null;
  playerOrder: [PlayerId, PlayerId];
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;
  players: Record<PlayerId, PlayerState>;
  cardInstances: Record<CardInstanceId, CardInstance>;
  activeEffects: ActiveEffect[];
  supportFinishedBy: PlayerId[];
  lastRoundResult: RoundResult | null;
  winner: GameWinner | null;
  processedCommandIds: CommandId[];
  nextEffectSequence: number;
  nextEventSequence: number;
};

export type EntityIdKind = "cardInstance" | "attackGroup" | "activeEffect";

export type IdGenerationInput = {
  kind: EntityIdKind;
  gameId: GameId;
  seed: string;
};

export type RandomSequence = {
  next(): number;
};

export type RandomGenerator = {
  create(seed: string): RandomSequence;
};

export type GameClock = {
  now(): number;
};

export type IdGenerator = {
  generate(input: IdGenerationInput): string;
};

export type GameEngineDependencies = {
  random: RandomGenerator;
  clock: GameClock;
  idGenerator: IdGenerator;
};

export type StateValidationIssue = {
  code: string;
  message: string;
  details?: JsonObject;
};

export type StateValidationResult =
  | { valid: true }
  | {
      valid: false;
      issues: StateValidationIssue[];
    };
