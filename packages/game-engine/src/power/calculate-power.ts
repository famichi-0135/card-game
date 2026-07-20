import type { GameEngineContext } from "../contracts/engine.js";
import type { GameState } from "../contracts/game-state.js";
import type { ActiveEffect } from "../contracts/effects.js";
import type {
  AttackGroupId,
  CardInstanceId,
  PlayerId,
} from "../contracts/identifiers.js";
import {
  getCardDefinitionForInstance,
  getPlayer,
} from "../state/card-access.js";

export function calculateCardPower(
  state: GameState,
  cardInstanceId: CardInstanceId,
  context: GameEngineContext,
): number {
  const definition = getCardDefinitionForInstance(
    state,
    cardInstanceId,
    context,
  );
  if (definition?.cardType !== "attack") {
    throw new Error(`カード ${cardInstanceId} は攻撃カードではありません。`);
  }

  return Math.max(
    1,
    Math.floor(
      applyPowerEffects(
        definition.basePower,
        state.activeEffects.filter(
          (effect) =>
            effect.scope === "cardPower" &&
            effect.target.type === "attackCard" &&
            effect.target.cardInstanceId === cardInstanceId,
        ),
      ),
    ),
  );
}

export function calculateGroupPower(
  state: GameState,
  groupId: AttackGroupId,
  context: GameEngineContext,
): number {
  const group = findAttackGroup(state, groupId);
  if (group === undefined) {
    throw new Error(`攻撃グループ ${groupId} が見つかりません。`);
  }

  const basePower = group.cardIds.reduce(
    (total, cardInstanceId) =>
      total + calculateCardPower(state, cardInstanceId, context),
    0,
  );
  return Math.max(
    0,
    Math.floor(
      applyPowerEffects(
        basePower,
        state.activeEffects.filter(
          (effect) =>
            effect.scope === "groupPower" &&
            effect.target.type === "attackGroup" &&
            effect.target.groupId === groupId,
        ),
      ),
    ),
  );
}

export function calculateTotalPower(
  state: GameState,
  playerId: PlayerId,
  context: GameEngineContext,
): number {
  const player = getPlayer(state, playerId);
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }

  const basePower = player.battlefield.attackGroups.reduce(
    (total, group) =>
      total + calculateGroupPower(state, group.groupId, context),
    0,
  );
  return Math.max(
    0,
    Math.floor(
      applyPowerEffects(
        basePower,
        state.activeEffects.filter(
          (effect) =>
            effect.scope === "totalPower" &&
            effect.target.type === "player" &&
            effect.target.playerId === playerId,
        ),
      ),
    ),
  );
}

function findAttackGroup(state: GameState, groupId: AttackGroupId) {
  for (const player of Object.values(state.players)) {
    const group = player.battlefield.attackGroups.find(
      (candidate) => candidate.groupId === groupId,
    );
    if (group !== undefined) {
      return group;
    }
  }
  return undefined;
}

function applyPowerEffects(basePower: number, effects: ActiveEffect[]): number {
  const latestOverwrite = effects
    .filter((effect) => effect.operation === "overwrite")
    .reduce<
      ActiveEffect | undefined
    >((latest, effect) => (latest === undefined || effect.appliedSequence > latest.appliedSequence ? effect : latest), undefined);
  const overwritten = latestOverwrite?.value ?? basePower;
  const added = effects
    .filter((effect) => effect.operation === "add")
    .reduce((total, effect) => total + effect.value, overwritten);
  const multiplied = effects
    .filter((effect) => effect.operation === "multiply")
    .reduce((total, effect) => total * effect.value, added);

  return multiplied;
}
