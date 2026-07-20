import type { Attribute } from "./card-definition.js";
import type { AttackGroupId, CardInstanceId, PlayerId } from "./identifiers.js";

export type EffectTarget =
  | {
      type: "attackCard";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "attackGroup";
      groupId: AttackGroupId;
    }
  | {
      type: "supportCard";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "player";
      playerId: PlayerId;
    }
  | {
      type: "mana";
      playerId: PlayerId;
      attribute: Attribute;
    };

export type TargetSide = "self" | "opponent" | "either";
export type TargetZone = EffectTarget["type"];

export type TargetRule = {
  required: boolean;
  minTargets: number;
  maxTargets: number;
  side: TargetSide;
  zones: TargetZone[];
  allowSourceCard: boolean;
};
