import type { Attribute } from "./card-definition.js";
import type { ActiveEffect } from "./effects.js";
import type {
  AttackGroupId,
  CardInstanceId,
  EffectId,
  EffectInstanceId,
  PlayerId,
} from "./identifiers.js";
import type { GamePhase } from "./game-state.js";

export type GameWinner =
  | {
      type: "player";
      playerId: PlayerId;
      reason:
        | "stamina"
        | "deckOut"
        | "maxRoundStamina"
        | "maxRoundPower"
        | "disconnectTimeout";
    }
  | {
      type: "draw";
      reason:
        | "bothStaminaZero"
        | "deckOutEqualStamina"
        | "maxRoundEqual"
        | "bothDisconnected";
    };

export type RoundResult = {
  round: number;
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;
  totalPowers: Record<PlayerId, number>;
  staminaBefore: Record<PlayerId, number>;
  staminaAfter: Record<PlayerId, number>;
  higherPowerPlayerId: PlayerId | null;
  nextFirstPlayerId: PlayerId | null;
};

export type GameProgressEvent =
  | {
      type: "GAME_STARTED";
      firstPlayerId: PlayerId;
    }
  | {
      type: "ROUND_STARTED";
      round: number;
      firstPlayerId: PlayerId;
      secondPlayerId: PlayerId;
    }
  | {
      type: "PHASE_CHANGED";
      phase: GamePhase;
      phaseSequence: number;
      deadlineAt: number | null;
    }
  | {
      type: "CARDS_DRAWN";
      playerId: PlayerId;
      reason: "initial" | "refill" | "effect";
      cardInstanceIds: CardInstanceId[];
    }
  | {
      type: "MANA_GAINED";
      playerId: PlayerId;
      attribute: Attribute;
      amount: number;
    }
  | {
      type: "CARD_DISCARDED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ATTACK_GROUP_CREATED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "CARD_CHAINED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ATTACK_GROUP_REMOVED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceIds: CardInstanceId[];
    }
  | {
      type: "SUPPORT_CARD_PLAYED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "SUPPORT_FINISHED";
      playerId: PlayerId;
    }
  | {
      type: "SUPPORT_PHASE_ENDED";
    }
  | {
      type: "POWER_CALCULATED";
      playerPowers: Record<PlayerId, number>;
    }
  | {
      type: "STAMINA_CHANGED";
      playerId: PlayerId;
      before: number;
      after: number;
    }
  | {
      type: "ROUND_RESOLVED";
      result: RoundResult;
    }
  | {
      type: "GAME_FINISHED";
      winner: GameWinner;
    };

export type ActiveEffectRemovalReason =
  | "durationEnded"
  | "sourceLeftField"
  | "targetLeftField"
  | "gameFinished";

export type CardEffectEvent =
  | {
      type: "CARD_EFFECT_ACTIVATED";
      sourceCardInstanceId: CardInstanceId;
      effectId: EffectId;
      ownerId: PlayerId;
    }
  | {
      type: "CARD_EFFECT_RESOLVED";
      sourceCardInstanceId: CardInstanceId;
      effectId: EffectId;
    }
  | {
      type: "ACTIVE_EFFECT_ADDED";
      activeEffect: ActiveEffect;
    }
  | {
      type: "ACTIVE_EFFECT_REMOVED";
      effectInstanceId: EffectInstanceId;
      reason: ActiveEffectRemovalReason;
    }
  | {
      type: "MANA_REDUCED";
      playerId: PlayerId;
      attribute: Attribute;
      requestedAmount: number;
      actualAmount: number;
    }
  | {
      type: "SUPPORT_CARD_REMOVED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    };

export type DomainEvent = GameProgressEvent | CardEffectEvent;

export type GameEventEnvelope = {
  sequence: number;
  stateVersion: number;
  occurredAt: number;
  event: DomainEvent;
};
