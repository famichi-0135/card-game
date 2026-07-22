import type { Attribute } from "../contracts/card-definition.js";

/** 攻撃グループへカードを連鎖できるかを、公開可能な定義情報だけで判定する。 */
export function canChainAttackCard(
  groupAttribute: Attribute,
  cardAttribute: Attribute,
  topCardChainableDefinitionIds: readonly string[],
  cardDefinitionId: string,
): boolean {
  return (
    groupAttribute === cardAttribute &&
    topCardChainableDefinitionIds.includes(cardDefinitionId)
  );
}

/** 連鎖により追加で予約するみなもと量を返す。 */
export function getAdditionalAttackGroupManaRequired(
  currentRequiredMana: number,
  cardCost: number,
): number {
  return Math.max(0, cardCost - currentRequiredMana);
}

export function hasAvailableMana(
  availableMana: number,
  requiredMana: number,
): boolean {
  return availableMana >= requiredMana;
}
