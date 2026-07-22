import type {
  GameRules,
  GameRulesValidationError,
  GameRulesValidationResult,
} from "../contracts/rules.js";
import { ATTACK_GROUP_SLOT_INDICES } from "../contracts/game-state.js";

const nonNegativeIntegerFields = [
  "deckSize",
  "initialStamina",
  "initialDrawCount",
  "handLimit",
  "maxAttackGroups",
  "placementTimeLimitMs",
  "supportTimeLimitMs",
  "maxRounds",
  "minManaCards",
  "maxManaCards",
  "minAttackCards",
  "maxSupportCards",
  "maxSameNamedAttackCards",
  "maxSameNamedSupportCards",
] as const satisfies readonly (keyof GameRules)[];

export function validateGameRules(
  rules: Readonly<GameRules>,
): GameRulesValidationResult {
  const errors: GameRulesValidationError[] = [];

  if (rules.playerCount !== 2) {
    errors.push({
      code: "UNSUPPORTED_PLAYER_COUNT",
      field: "playerCount",
      message: "初期ゲームエンジンは2人対戦のみをサポートします。",
    });
  }

  if (rules.maxAttackGroups !== ATTACK_GROUP_SLOT_INDICES.length) {
    errors.push({
      code: "INVALID_RANGE",
      field: "maxAttackGroups",
      message: `maxAttackGroupsは固定盤面の${ATTACK_GROUP_SLOT_INDICES.length}でなければなりません。`,
    });
  }

  for (const field of nonNegativeIntegerFields) {
    const value = rules[field];
    if (!Number.isSafeInteger(value) || value < 0) {
      errors.push({
        code: "INVALID_INTEGER_VALUE",
        field,
        message: `${field}は0以上の安全な整数でなければなりません。`,
      });
    }
  }

  if (rules.version.trim().length === 0) {
    errors.push({
      code: "INVALID_RANGE",
      field: "version",
      message: "ルールセットバージョンは空文字列にできません。",
    });
  }

  if (rules.minManaCards > rules.maxManaCards) {
    errors.push({
      code: "INVALID_RANGE",
      field: "minManaCards",
      message: "みなもとカードの最小枚数は最大枚数以下でなければなりません。",
    });
  }

  if (
    rules.initialDrawCount > rules.deckSize ||
    rules.handLimit > rules.deckSize
  ) {
    errors.push({
      code: "INVALID_RANGE",
      message: "初期手札枚数と手札上限はデッキ枚数以下でなければなりません。",
    });
  }

  if (rules.initialDrawCount > rules.handLimit) {
    errors.push({
      code: "INVALID_RANGE",
      field: "initialDrawCount",
      message: "初期手札枚数は手札上限以下でなければなりません。",
    });
  }

  if (rules.minManaCards + rules.minAttackCards > rules.deckSize) {
    errors.push({
      code: "INVALID_DECK_COMPOSITION",
      message:
        "みなもとカードと攻撃カードの最小枚数がデッキ枚数を超えています。",
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
