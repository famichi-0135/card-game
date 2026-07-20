import type { Attribute } from "../contracts/card-definition.js";
import type { GameEngineContext } from "../contracts/engine.js";
import type {
  AttackGroup,
  CalculatedManaState,
  GameState,
} from "../contracts/game-state.js";
import type { PlayerId } from "../contracts/identifiers.js";
import {
  getCardDefinitionForInstance,
  getPlayer,
} from "../state/card-access.js";

export function calculateMana(
  state: GameState,
  playerId: PlayerId,
  attribute: Attribute,
  context: GameEngineContext,
): CalculatedManaState {
  const player = getPlayer(state, playerId);
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }

  const total = player.mana[attribute].total;
  const attackReserved = player.battlefield.attackGroups
    .filter((group) => group.attribute === attribute)
    .reduce(
      (reserved, group) =>
        reserved + calculateAttackGroupCost(state, group, context),
      0,
    );
  const supportReserved = player.battlefield.supportZone.reduce(
    (reserved, support) => {
      const definition = getCardDefinitionForInstance(
        state,
        support.cardInstanceId,
        context,
      );
      if (definition?.cardType !== "support") {
        throw new Error("サポートゾーンにサポートカード以外が存在します。");
      }
      return definition.attribute === attribute &&
        support.duration !== "instant"
        ? reserved + definition.cost
        : reserved;
    },
    0,
  );
  const reserved = attackReserved + supportReserved;

  return { total, reserved, available: total - reserved };
}

export function calculateAttackGroupCost(
  state: GameState,
  group: AttackGroup,
  context: GameEngineContext,
): number {
  if (group.cardIds.length === 0) {
    throw new Error(`攻撃グループ ${group.groupId} が空です。`);
  }

  let highestCost = 0;
  for (const cardInstanceId of group.cardIds) {
    const definition = getCardDefinitionForInstance(
      state,
      cardInstanceId,
      context,
    );
    if (definition?.cardType !== "attack") {
      throw new Error("攻撃グループに攻撃カード以外が存在します。");
    }
    highestCost = Math.max(highestCost, definition.cost);
  }
  return highestCost;
}
