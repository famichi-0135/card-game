import type { GameActionUnavailableReasonCode } from "@disastar/game-engine";

export const ACTION_UNAVAILABLE_MESSAGES: Record<
  GameActionUnavailableReasonCode,
  string
> = {
  GAME_NOT_ACTIVE: "ゲームは現在進行中ではありません。",
  CARD_CATALOG_VERSION_MISMATCH: "カードデータが一致しません。",
  CARD_DEFINITION_NOT_FOUND: "カードデータが見つかりません。",
  PHASE_DEADLINE_EXPIRED: "制限時間を過ぎております。",
  INVALID_PHASE: "現在のフェーズでは配置できません。",
  NOT_CURRENT_PLAYER: "あなたのターンではありません。",
  INVALID_CARD_TYPE: "このゾーンには配置できないカードです。",
  ATTACK_GROUP_LIMIT_REACHED: "これ以上配置できません。",
  ATTACK_GROUP_SLOT_UNAVAILABLE: "このスロットには配置できません。",
  INSUFFICIENT_MANA: "マナが足りません。",
  CHAIN_NOT_ALLOWED: "このカードに連鎖（重ねがけ）することはできません。",
  SUPPORT_ALREADY_FINISHED: "サポートフェーズはすでに終了しております。",
  EFFECT_TARGET_UNAVAILABLE: "効果の対象が存在しません。",
};

export function getActionUnavailableMessage(
  reason: GameActionUnavailableReasonCode,
): string {
  return ACTION_UNAVAILABLE_MESSAGES[reason];
}
