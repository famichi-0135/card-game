import type { ActiveEffect } from "./effects.js";
import type { Attribute, Faction } from "./card-definition.js";
import type {
  CardCatalogVersion,
  CardInstanceId,
  GameId,
  PlayerId,
  RulesetVersion,
} from "./identifiers.js";
import type {
  AttackGroup,
  CardInstance,
  CalculatedManaState,
  GamePhase,
  GameStatus,
} from "./game-state.js";
import type {
  DomainEvent,
  GameEventEnvelope,
  GameWinner,
  RoundResult,
} from "./events.js";

export type VisibleCardInstance = Pick<
  CardInstance,
  "instanceId" | "definitionId" | "ownerId"
>;

export type VisibleAttackGroup = Omit<AttackGroup, "cardIds"> & {
  cards: VisibleCardInstance[];
  requiredMana: number;
  currentPower: number;
};

export type PublicPlayerState = {
  playerId: PlayerId;
  faction: Faction;
  stamina: number;
  handCount: number;
  deckCount: number;
  discardPile: VisibleCardInstance[];
  attackGroups: VisibleAttackGroup[];
  supportZone: VisibleCardInstance[];
  mana: Record<Attribute, CalculatedManaState>;
  activeEffects: ActiveEffect[];
  supportFinished: boolean;
};

export type PlayerGameView = {
  gameId: GameId;
  rulesetVersion: RulesetVersion;
  cardCatalogVersion: CardCatalogVersion;
  stateVersion: number;
  status: GameStatus;
  round: number;
  phase: GamePhase;
  phaseSequence: number;
  phaseDeadlineAt: number | null;
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;
  viewerPlayerId: PlayerId;
  self: PublicPlayerState & {
    hand: VisibleCardInstance[];
  };
  opponent: PublicPlayerState;
  lastRoundResult: RoundResult | null;
  winner: GameWinner | null;
};

export type PlayerVisibleCardsDrawnEvent = {
  type: "CARDS_DRAWN";
  playerId: PlayerId;
  reason: "initial" | "refill" | "effect";
  count: number;
  cardInstanceIds?: CardInstanceId[];
};

export type PlayerVisibleEvent =
  | Exclude<DomainEvent, { type: "CARDS_DRAWN" }>
  | PlayerVisibleCardsDrawnEvent;

export type PlayerVisibleEventEnvelope = Omit<GameEventEnvelope, "event"> & {
  event: PlayerVisibleEvent;
};
