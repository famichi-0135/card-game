import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type {
  EffectPlanOperation,
  EffectResolutionPlan,
  EffectValidationError,
} from "../contracts/effects.js";
import type { EffectTarget } from "../contracts/effect-target.js";
import type { DomainEvent } from "../contracts/events.js";
import type {
  GameEngineDependencies,
  GameState,
} from "../contracts/game-state.js";
import type { GameEngineContext } from "../contracts/engine.js";
import { getCardDefinitionForInstance } from "../state/card-access.js";
import { calculateMana } from "../mana/calculate-mana.js";

export type EffectPlanApplicationResult =
  | { applied: true; events: DomainEvent[] }
  | { applied: false; error: EffectValidationError };

export function applyEffectResolutionPlan(
  state: GameState,
  plan: DeepReadonly<EffectResolutionPlan>,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): EffectPlanApplicationResult {
  const events: DomainEvent[] = [];

  if (!Array.isArray(plan.operations)) {
    return {
      applied: false,
      error: effectError(
        "EFFECT_PLANNING_FAILED",
        "効果計画の操作列が不正です。",
      ),
    };
  }

  for (const operation of plan.operations) {
    if (
      typeof operation !== "object" ||
      operation === null ||
      !("type" in operation)
    ) {
      return {
        applied: false,
        error: effectError(
          "EFFECT_PLANNING_FAILED",
          "効果計画の操作が不正です。",
        ),
      };
    }
    const result = applyOperation(state, operation, context, dependencies);
    if (!result.applied) {
      return result;
    }
    events.push(...result.events);
  }

  return { applied: true, events };
}

function applyOperation(
  state: GameState,
  operation: DeepReadonly<EffectPlanOperation>,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): EffectPlanApplicationResult {
  switch (operation.type) {
    case "ADD_ACTIVE_EFFECT":
      return addActiveEffect(state, operation, dependencies);
    case "CHANGE_STAMINA":
      return changeStamina(state, operation);
    case "REDUCE_MANA":
      return reduceMana(state, operation, context);
    case "DRAW_CARDS":
      return drawCards(state, operation, context);
    case "REMOVE_ATTACK_GROUP":
      return removeAttackGroup(state, operation);
    case "REMOVE_SUPPORT_CARD":
      return removeSupportCard(state, operation);
    default:
      return {
        applied: false,
        error: effectError("EFFECT_PLANNING_FAILED", "未対応の効果操作です。"),
      };
  }
}

function changeStamina(
  state: GameState,
  operation: Extract<
    DeepReadonly<EffectPlanOperation>,
    { type: "CHANGE_STAMINA" }
  >,
): EffectPlanApplicationResult {
  if (
    typeof operation.playerId !== "string" ||
    !Number.isSafeInteger(operation.amount)
  ) {
    return invalidOperation("スタミナ変更の操作内容が不正です。");
  }
  const player = state.players[operation.playerId];
  if (player === undefined) {
    return targetNotFound("スタミナ変更の対象プレイヤーが見つかりません。");
  }
  const before = player.stamina;
  player.stamina += operation.amount;
  return {
    applied: true,
    events: [
      {
        type: "STAMINA_CHANGED",
        playerId: player.playerId,
        before,
        after: player.stamina,
      },
    ],
  };
}

function reduceMana(
  state: GameState,
  operation: Extract<
    DeepReadonly<EffectPlanOperation>,
    { type: "REDUCE_MANA" }
  >,
  context: GameEngineContext,
): EffectPlanApplicationResult {
  if (
    typeof operation.playerId !== "string" ||
    !["attributeA", "attributeB", "attributeC"].includes(operation.attribute) ||
    !Number.isSafeInteger(operation.requestedAmount) ||
    operation.requestedAmount < 0
  ) {
    return invalidOperation("みなもと減少の操作内容が不正です。");
  }
  const player = state.players[operation.playerId];
  if (player === undefined) {
    return targetNotFound("みなもと減少の対象プレイヤーが見つかりません。");
  }
  const calculated = calculateMana(
    state,
    player.playerId,
    operation.attribute,
    context,
  );
  const actualAmount = Math.max(
    0,
    Math.min(
      operation.requestedAmount,
      calculated.total - calculated.reserved,
      calculated.total - 1,
    ),
  );
  player.mana[operation.attribute].total -= actualAmount;
  return {
    applied: true,
    events: [
      {
        type: "MANA_REDUCED",
        playerId: player.playerId,
        attribute: operation.attribute,
        requestedAmount: operation.requestedAmount,
        actualAmount,
      },
    ],
  };
}

function drawCards(
  state: GameState,
  operation: Extract<DeepReadonly<EffectPlanOperation>, { type: "DRAW_CARDS" }>,
  context: GameEngineContext,
): EffectPlanApplicationResult {
  if (
    typeof operation.playerId !== "string" ||
    !Number.isSafeInteger(operation.count) ||
    operation.count < 0
  ) {
    return invalidOperation("カードドローの操作内容が不正です。");
  }
  const player = state.players[operation.playerId];
  if (player === undefined) {
    return targetNotFound("カードドローの対象プレイヤーが見つかりません。");
  }

  const count = Math.min(
    operation.count,
    Math.max(0, context.rules.handLimit - player.hand.length),
    player.deck.length,
  );
  if (count === 0) {
    return { applied: true, events: [] };
  }

  const drawnCardIds = player.deck.splice(0, count);
  player.hand.push(...drawnCardIds);
  const events: DomainEvent[] = [
    {
      type: "CARDS_DRAWN",
      playerId: player.playerId,
      reason: "effect",
      cardInstanceIds: drawnCardIds,
    },
  ];
  const gainedByAttribute = {
    attributeA: 0,
    attributeB: 0,
    attributeC: 0,
  };

  for (const cardInstanceId of drawnCardIds) {
    const definition = getCardDefinitionForInstance(
      state,
      cardInstanceId,
      context,
    );
    if (definition === undefined) {
      return {
        applied: false,
        error: effectError(
          "RESULTING_STATE_INVALID",
          "ドローしたカードの定義が見つかりません。",
        ),
      };
    }
    if (definition.cardType !== "mana") {
      continue;
    }
    const handIndex = player.hand.indexOf(cardInstanceId);
    if (handIndex < 0) {
      return {
        applied: false,
        error: effectError(
          "RESULTING_STATE_INVALID",
          "ドローしたみなもとカードが手札に存在しません。",
        ),
      };
    }
    player.hand.splice(handIndex, 1);
    player.discardPile.push(cardInstanceId);
    player.mana[definition.attribute].total += definition.manaAmount;
    gainedByAttribute[definition.attribute] += definition.manaAmount;
  }
  for (const attribute of ["attributeA", "attributeB", "attributeC"] as const) {
    const amount = gainedByAttribute[attribute];
    if (amount > 0) {
      events.push({
        type: "MANA_GAINED",
        playerId: player.playerId,
        attribute,
        amount,
      });
    }
  }
  return { applied: true, events };
}

function removeAttackGroup(
  state: GameState,
  operation: Extract<
    DeepReadonly<EffectPlanOperation>,
    { type: "REMOVE_ATTACK_GROUP" }
  >,
): EffectPlanApplicationResult {
  if (typeof operation.groupId !== "string") {
    return invalidOperation("攻撃グループ除去の操作内容が不正です。");
  }
  const player = Object.values(state.players).find((candidate) =>
    candidate.battlefield.attackGroups.some(
      (group) => group.groupId === operation.groupId,
    ),
  );
  const groupIndex = player?.battlefield.attackGroups.findIndex(
    (group) => group.groupId === operation.groupId,
  );
  if (player === undefined || groupIndex === undefined || groupIndex < 0) {
    return targetNotFound("除去対象の攻撃グループが見つかりません。");
  }

  const group = player.battlefield.attackGroups[groupIndex];
  if (group === undefined) {
    return targetNotFound("除去対象の攻撃グループが見つかりません。");
  }
  const removedCardIds = [...group.cardIds].reverse();
  player.battlefield.attackGroups.splice(groupIndex, 1);
  player.discardPile.push(...removedCardIds);
  const removedCardIdSet = new Set(removedCardIds);
  const events = removeRelatedActiveEffects(
    state,
    (effect) =>
      removedCardIdSet.has(effect.sourceCardInstanceId) ||
      (effect.target.type === "attackGroup" &&
        effect.target.groupId === group.groupId) ||
      (effect.target.type === "attackCard" &&
        removedCardIdSet.has(effect.target.cardInstanceId)),
    (effect) =>
      removedCardIdSet.has(effect.sourceCardInstanceId)
        ? "sourceLeftField"
        : "targetLeftField",
  );
  events.push({
    type: "ATTACK_GROUP_REMOVED",
    playerId: player.playerId,
    groupId: group.groupId,
    cardInstanceIds: removedCardIds,
  });
  return { applied: true, events };
}

function removeSupportCard(
  state: GameState,
  operation: Extract<
    DeepReadonly<EffectPlanOperation>,
    { type: "REMOVE_SUPPORT_CARD" }
  >,
): EffectPlanApplicationResult {
  if (typeof operation.cardInstanceId !== "string") {
    return invalidOperation("サポートカード除去の操作内容が不正です。");
  }
  const player = Object.values(state.players).find((candidate) =>
    candidate.battlefield.supportZone.some(
      (card) => card.cardInstanceId === operation.cardInstanceId,
    ),
  );
  const supportIndex = player?.battlefield.supportZone.findIndex(
    (card) => card.cardInstanceId === operation.cardInstanceId,
  );
  if (player === undefined || supportIndex === undefined || supportIndex < 0) {
    return targetNotFound("除去対象のサポートカードが見つかりません。");
  }

  player.battlefield.supportZone.splice(supportIndex, 1);
  player.discardPile.push(operation.cardInstanceId);
  const events = removeRelatedActiveEffects(
    state,
    (effect) =>
      effect.sourceCardInstanceId === operation.cardInstanceId ||
      (effect.target.type === "supportCard" &&
        effect.target.cardInstanceId === operation.cardInstanceId),
    (effect) =>
      effect.sourceCardInstanceId === operation.cardInstanceId
        ? "sourceLeftField"
        : "targetLeftField",
  );
  events.push({
    type: "SUPPORT_CARD_REMOVED",
    playerId: player.playerId,
    cardInstanceId: operation.cardInstanceId,
  });
  return { applied: true, events };
}

function removeRelatedActiveEffects(
  state: GameState,
  shouldRemove: (effect: GameState["activeEffects"][number]) => boolean,
  getReason: (
    effect: GameState["activeEffects"][number],
  ) => "sourceLeftField" | "targetLeftField",
): DomainEvent[] {
  const removedEffects = state.activeEffects.filter(shouldRemove);
  state.activeEffects = state.activeEffects.filter(
    (effect) => !shouldRemove(effect),
  );
  return removedEffects.map((effect) => ({
    type: "ACTIVE_EFFECT_REMOVED",
    effectInstanceId: effect.effectInstanceId,
    reason: getReason(effect),
  }));
}

function invalidOperation(message: string): EffectPlanApplicationResult {
  return {
    applied: false,
    error: effectError("EFFECT_PLANNING_FAILED", message),
  };
}

function targetNotFound(message: string): EffectPlanApplicationResult {
  return {
    applied: false,
    error: effectError("TARGET_NO_LONGER_VALID", message),
  };
}

function addActiveEffect(
  state: GameState,
  operation: Extract<
    DeepReadonly<EffectPlanOperation>,
    { type: "ADD_ACTIVE_EFFECT" }
  >,
  dependencies: GameEngineDependencies,
): EffectPlanApplicationResult {
  if (typeof operation.effect !== "object" || operation.effect === null) {
    return {
      applied: false,
      error: effectError(
        "EFFECT_PLANNING_FAILED",
        "継続効果の計画が不正です。",
      ),
    };
  }
  const draft = operation.effect;
  const sourceCard = state.cardInstances[draft.sourceCardInstanceId];
  const owner = state.players[draft.ownerId];
  if (
    sourceCard === undefined ||
    sourceCard.ownerId !== draft.ownerId ||
    owner === undefined ||
    !owner.battlefield.supportZone.some(
      (card) => card.cardInstanceId === draft.sourceCardInstanceId,
    )
  ) {
    return {
      applied: false,
      error: effectError(
        "SOURCE_CARD_NOT_ON_EXPECTED_ZONE",
        "継続効果の効果元カードはサポートゾーンに存在する必要があります。",
      ),
    };
  }
  if (findTargetOwnerId(state, draft.target) === undefined) {
    return {
      applied: false,
      error: effectError(
        "TARGET_NO_LONGER_VALID",
        "継続効果の対象が現在の状態に存在しません。",
      ),
    };
  }
  if (!isTargetTypeCompatibleWithScope(draft.target, draft.scope)) {
    return {
      applied: false,
      error: effectError(
        "INVALID_TARGET_TYPE",
        "継続効果の対象種別がscopeと一致しません。",
      ),
    };
  }
  if (
    !Number.isFinite(draft.value) ||
    !["cardPower", "groupPower", "totalPower"].includes(draft.scope) ||
    !["overwrite", "add", "multiply"].includes(draft.operation) ||
    !["untilRoundEnd", "whileSourceOnField"].includes(draft.duration)
  ) {
    return {
      applied: false,
      error: effectError("EFFECT_CONFIG_INVALID", "継続効果の設定が不正です。"),
    };
  }

  const effectInstanceId = dependencies.idGenerator.generate({
    kind: "activeEffect",
    gameId: state.gameId,
    seed: `${draft.sourceCardInstanceId}:${draft.effectId}:${state.nextEffectSequence}`,
  });
  if (
    typeof effectInstanceId !== "string" ||
    effectInstanceId.trim().length === 0
  ) {
    return {
      applied: false,
      error: effectError(
        "EFFECT_PLANNING_FAILED",
        "効果インスタンスIDが不正です。",
      ),
    };
  }
  if (
    state.activeEffects.some(
      (effect) => effect.effectInstanceId === effectInstanceId,
    )
  ) {
    return {
      applied: false,
      error: effectError(
        "EFFECT_PLANNING_FAILED",
        "効果インスタンスIDが重複しました。",
      ),
    };
  }

  const activeEffect = {
    ...draft,
    effectInstanceId,
    appliedSequence: state.nextEffectSequence,
    appliedRound: state.round,
  };
  state.nextEffectSequence += 1;
  state.activeEffects.push(activeEffect);
  return {
    applied: true,
    events: [{ type: "ACTIVE_EFFECT_ADDED", activeEffect }],
  };
}

function effectError(
  code: EffectValidationError["code"],
  message: string,
): EffectValidationError {
  return { code, message };
}

function findTargetOwnerId(
  state: GameState,
  target: DeepReadonly<EffectTarget>,
): string | undefined {
  switch (target.type) {
    case "player":
    case "mana":
      return state.players[target.playerId]?.playerId;
    case "attackGroup":
      return Object.values(state.players).find((player) =>
        player.battlefield.attackGroups.some(
          (group) => group.groupId === target.groupId,
        ),
      )?.playerId;
    case "attackCard":
      return Object.values(state.players).find((player) =>
        player.battlefield.attackGroups.some((group) =>
          group.cardIds.includes(target.cardInstanceId),
        ),
      )?.playerId;
    case "supportCard":
      return Object.values(state.players).find((player) =>
        player.battlefield.supportZone.some(
          (card) => card.cardInstanceId === target.cardInstanceId,
        ),
      )?.playerId;
  }
}

function isTargetTypeCompatibleWithScope(
  target: DeepReadonly<EffectTarget>,
  scope: "cardPower" | "groupPower" | "totalPower",
): boolean {
  return (
    (scope === "cardPower" && target.type === "attackCard") ||
    (scope === "groupPower" && target.type === "attackGroup") ||
    (scope === "totalPower" && target.type === "player")
  );
}
