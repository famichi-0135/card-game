import type { GameCommandError } from "./errors.js";
import type { EffectInput } from "./effects.js";
import type {
  AttackGroupId,
  CardDefinitionId,
  CardInstanceId,
  CommandId,
  GameId,
  PlayerId,
} from "./identifiers.js";
import type { GameEventEnvelope } from "./events.js";
import type { GameState } from "./game-state.js";
import type { JsonObject } from "./json.js";

export type InitializeGameInput = {
  gameId: GameId;
  randomSeed: string;
  players: [
    {
      playerId: PlayerId;
      deckDefinitionIds: CardDefinitionId[];
    },
    {
      playerId: PlayerId;
      deckDefinitionIds: CardDefinitionId[];
    },
  ];
};

export type InitializeGameError = {
  code:
    | "INVALID_PLAYER_COUNT"
    | "DUPLICATE_PLAYER_ID"
    | "DECK_VALIDATION_FAILED"
    | "CARD_CATALOG_INVALID"
    | "DEPENDENCY_OUTPUT_INVALID"
    | "INITIAL_HAND_SELECTION_FAILED";
  message: string;
  details?: JsonObject;
};

export type InitializeGameResult =
  | {
      initialized: true;
      state: GameState;
      events: GameEventEnvelope[];
    }
  | {
      initialized: false;
      error: InitializeGameError;
    };

export type DeckValidationError = {
  code:
    | "INVALID_DECK_SIZE"
    | "INVALID_CARD_TYPE_COUNT"
    | "SAME_NAME_LIMIT_EXCEEDED"
    | "ATTRIBUTE_REQUIREMENT_NOT_MET"
    | "CARD_DEFINITION_NOT_FOUND"
    | "CARD_DEFINITION_INVALID";
  cardDefinitionId?: CardDefinitionId;
  message: string;
};

export type DeckValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      errors: DeckValidationError[];
    };

export type BaseGameCommand = {
  commandId: CommandId;
  gameId: GameId;
  playerId: PlayerId;
  phaseSequence: number;
  clientStateVersion: number;
  issuedAt: number;
};

export type PlaceAttackCardCommand = BaseGameCommand & {
  type: "PLACE_ATTACK_CARD";
  cardInstanceId: CardInstanceId;
  effectInputs: EffectInput[];
};

export type ChainAttackCardCommand = BaseGameCommand & {
  type: "CHAIN_ATTACK_CARD";
  cardInstanceId: CardInstanceId;
  targetGroupId: AttackGroupId;
  effectInputs: EffectInput[];
};

export type DiscardHandCardCommand = BaseGameCommand & {
  type: "DISCARD_HAND_CARD";
  cardInstanceId: CardInstanceId;
};

export type FinishPlacementCommand = BaseGameCommand & {
  type: "FINISH_PLACEMENT";
};

export type PlaySupportCardCommand = BaseGameCommand & {
  type: "PLAY_SUPPORT_CARD";
  cardInstanceId: CardInstanceId;
  effectInputs: EffectInput[];
};

export type FinishSupportCommand = BaseGameCommand & {
  type: "FINISH_SUPPORT";
};

export type GameCommand =
  | PlaceAttackCardCommand
  | ChainAttackCardCommand
  | DiscardHandCardCommand
  | FinishPlacementCommand
  | PlaySupportCardCommand
  | FinishSupportCommand;

export type GameCommandParseError = {
  code: "INVALID_GAME_COMMAND";
  message: string;
  path: string;
};

export type ParseGameCommandResult =
  | {
      parsed: true;
      command: GameCommand;
    }
  | {
      parsed: false;
      errors: GameCommandParseError[];
    };

export type HandlePhaseTimeoutCommand = {
  type: "HANDLE_PHASE_TIMEOUT";
  gameId: GameId;
  phaseSequence: number;
};

export type SystemGameCommand = HandlePhaseTimeoutCommand;

export type ReceivedCommandEnvelope = {
  command: GameCommand | SystemGameCommand;
  receivedAt: number;
};

export type ExecuteCommandResult =
  | {
      accepted: true;
      state: GameState;
      events: GameEventEnvelope[];
    }
  | {
      accepted: false;
      state: GameState;
      error: GameCommandError;
    };
