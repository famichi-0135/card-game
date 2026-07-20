import type {
  Attribute,
  CardDefinition,
} from "../contracts/card-definition.js";
import type {
  ChainAttackCardCommand,
  DiscardHandCardCommand,
  ExecuteCommandResult,
  FinishPlacementCommand,
  FinishSupportCommand,
  GameCommand,
  HandlePhaseTimeoutCommand,
  PlaceAttackCardCommand,
  PlaySupportCardCommand,
  ReceivedCommandEnvelope,
} from "../contracts/commands.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type { GameEngineContext } from "../contracts/engine.js";
import type { EffectContext } from "../contracts/effects.js";
import type {
  GameCommandError,
  GameCommandErrorCode,
} from "../contracts/errors.js";
import type {
  DomainEvent,
  GameEventEnvelope,
  GameWinner,
  RoundResult,
} from "../contracts/events.js";
import type {
  GameEngineDependencies,
  GamePhase,
  GameState,
  PlayerState,
} from "../contracts/game-state.js";
import type {
  AttackGroupId,
  CardInstanceId,
  PlayerId,
} from "../contracts/identifiers.js";
import { calculateMana } from "../mana/calculate-mana.js";
import { calculateTotalPower } from "../power/calculate-power.js";
import { deepFreeze } from "../catalog/deep-freeze.js";
import { applyEffectResolutionPlan } from "../effects/apply-effect-resolution-plan.js";
import {
  planCardEffect,
  validateEffectInputs,
} from "../effects/plan-card-effect.js";
import {
  getCardDefinitionForInstance,
  getPlayer,
} from "../state/card-access.js";
import { validateGameState } from "../state/validate-game-state.js";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;

export function executeCommand(
  state: GameState,
  envelope: ReceivedCommandEnvelope,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): ExecuteCommandResult {
  const contextError = validateExecutionContext(state, context);
  if (contextError !== null) {
    return reject(state, contextError);
  }
  if (!Number.isFinite(envelope.receivedAt)) {
    return reject(
      state,
      commandError(
        "INVALID_COMMAND_TIMESTAMP",
        "受信時刻は有限数でなければなりません。",
      ),
    );
  }
  if (envelope.command.gameId !== state.gameId) {
    return reject(
      state,
      commandError("GAME_ID_MISMATCH", "コマンドのゲームIDが一致しません。"),
    );
  }

  if (envelope.command.type === "HANDLE_PHASE_TIMEOUT") {
    return executeTimeout(
      state,
      envelope.command,
      envelope.receivedAt,
      context,
    );
  }

  const command = envelope.command;
  if (state.processedCommandIds.includes(command.commandId)) {
    return reject(
      state,
      commandError(
        "COMMAND_ALREADY_PROCESSED",
        "このコマンドはすでに処理されています。",
      ),
    );
  }

  const commandErrorResult = validatePlayerCommand(
    state,
    command,
    envelope.receivedAt,
  );
  if (commandErrorResult !== null) {
    return reject(state, commandErrorResult);
  }

  const candidate = cloneGameState(state);
  const events: DomainEvent[] = [];

  try {
    const error = applyPlayerCommand(
      candidate,
      command,
      envelope.receivedAt,
      context,
      dependencies,
      events,
    );
    if (error !== null) {
      return reject(state, error);
    }
    candidate.processedCommandIds.push(command.commandId);
    return commit(state, candidate, events, envelope.receivedAt, context);
  } catch (error) {
    return reject(
      state,
      commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        error instanceof Error
          ? error.message
          : "コマンド処理中に内部エラーが発生しました。",
      ),
    );
  }
}

function validateExecutionContext(
  state: GameState,
  context: GameEngineContext,
): GameCommandError | null {
  if (
    state.rulesetVersion !== context.rules.version ||
    state.cardCatalogVersion !== context.cardCatalog.version ||
    state.engineSemanticsVersion !== context.engineSemanticsVersion
  ) {
    return commandError(
      "CONTEXT_VERSION_MISMATCH",
      "ゲーム状態とエンジンコンテキストのバージョンが一致しません。",
    );
  }

  const stateValidation = validateGameState(state, context);
  return stateValidation.valid
    ? null
    : commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        "入力ゲーム状態が不変条件を満たしていません。",
      );
}

function validatePlayerCommand(
  state: GameState,
  command: GameCommand,
  receivedAt: number,
): GameCommandError | null {
  if (state.status !== "active") {
    return commandError("GAME_NOT_ACTIVE", "ゲームは進行中ではありません。");
  }
  if (getPlayer(state, command.playerId) === undefined) {
    return commandError("INVALID_TARGET", "操作プレイヤーが存在しません。");
  }
  if (command.phaseSequence !== state.phaseSequence) {
    return commandError(
      "PHASE_SEQUENCE_MISMATCH",
      "フェーズ世代が一致しません。",
    );
  }
  if (command.clientStateVersion > state.stateVersion) {
    return commandError(
      "CLIENT_STATE_VERSION_AHEAD",
      "クライアント状態バージョンがサーバー状態より新しいため拒否しました。",
    );
  }
  if (state.phaseDeadlineAt === null || receivedAt > state.phaseDeadlineAt) {
    return commandError(
      "PHASE_DEADLINE_EXPIRED",
      "フェーズ期限を過ぎています。",
    );
  }
  return null;
}

function applyPlayerCommand(
  state: GameState,
  command: GameCommand,
  receivedAt: number,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
  events: DomainEvent[],
): GameCommandError | null {
  switch (command.type) {
    case "PLACE_ATTACK_CARD":
      return placeAttackCard(
        state,
        command,
        receivedAt,
        context,
        dependencies,
        events,
      );
    case "CHAIN_ATTACK_CARD":
      return chainAttackCard(state, command, context, events);
    case "DISCARD_HAND_CARD":
      return discardHandCard(state, command, context, events);
    case "FINISH_PLACEMENT":
      return finishPlacement(state, command, receivedAt, context, events);
    case "FINISH_SUPPORT":
      return finishSupport(state, command, receivedAt, context, events);
    case "PLAY_SUPPORT_CARD":
      return playSupportCard(state, command, context, dependencies, events);
  }
}

function placeAttackCard(
  state: GameState,
  command: PlaceAttackCardCommand,
  receivedAt: number,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
  events: DomainEvent[],
): GameCommandError | null {
  const phaseError = validatePlacementPlayer(state, command.playerId);
  if (phaseError !== null) {
    return phaseError;
  }
  const card = validateAttackCardInHand(
    state,
    command.playerId,
    command.cardInstanceId,
    context,
  );
  if (isGameCommandError(card)) {
    return card;
  }
  if (command.effectInputs.length !== 0 || card.effects.length !== 0) {
    return commandError(
      "INVALID_EFFECT_INPUT",
      "攻撃カード効果の入力は許可されていません。",
    );
  }

  const player = getRequiredPlayer(state, command.playerId);
  if (player.battlefield.attackGroups.length >= context.rules.maxAttackGroups) {
    return commandError(
      "ATTACK_GROUP_LIMIT_REACHED",
      "攻撃グループ数が上限です。",
    );
  }

  const groupId = createAttackGroupId(state, command, dependencies);
  if (isGameCommandError(groupId)) {
    return groupId;
  }
  removeCardFromHand(player, command.cardInstanceId);
  player.battlefield.attackGroups.push({
    groupId,
    ownerId: command.playerId,
    attribute: card.attribute,
    cardIds: [command.cardInstanceId],
    createdRound: state.round,
  });

  const mana = calculateMana(state, command.playerId, card.attribute, context);
  if (mana.available < 0) {
    return commandError("INSUFFICIENT_MANA", "配置後のみなもとが不足します。");
  }
  events.push({
    type: "ATTACK_GROUP_CREATED",
    playerId: command.playerId,
    groupId,
    cardInstanceId: command.cardInstanceId,
  });
  return null;
}

function chainAttackCard(
  state: GameState,
  command: ChainAttackCardCommand,
  context: GameEngineContext,
  events: DomainEvent[],
): GameCommandError | null {
  const phaseError = validatePlacementPlayer(state, command.playerId);
  if (phaseError !== null) {
    return phaseError;
  }
  const card = validateAttackCardInHand(
    state,
    command.playerId,
    command.cardInstanceId,
    context,
  );
  if (isGameCommandError(card)) {
    return card;
  }
  if (command.effectInputs.length !== 0 || card.effects.length !== 0) {
    return commandError(
      "INVALID_EFFECT_INPUT",
      "攻撃カード効果の入力は許可されていません。",
    );
  }

  const player = getRequiredPlayer(state, command.playerId);
  const group = player.battlefield.attackGroups.find(
    (candidate) => candidate.groupId === command.targetGroupId,
  );
  if (group === undefined) {
    return commandError(
      "ATTACK_GROUP_NOT_FOUND",
      "対象攻撃グループが見つかりません。",
    );
  }
  if (group.attribute !== card.attribute) {
    return commandError(
      "ATTRIBUTE_MISMATCH",
      "連鎖するカードの属性が一致しません。",
    );
  }
  const topCardId = group.cardIds.at(-1);
  if (topCardId === undefined) {
    return commandError("ATTACK_GROUP_NOT_FOUND", "対象攻撃グループが空です。");
  }
  const topCard = getCardDefinitionForInstance(state, topCardId, context);
  if (
    topCard?.cardType !== "attack" ||
    !topCard.chainableCardIds.includes(card.id)
  ) {
    return commandError(
      "CHAIN_NOT_ALLOWED",
      "対象攻撃グループへ連鎖できません。",
    );
  }

  removeCardFromHand(player, command.cardInstanceId);
  group.cardIds.push(command.cardInstanceId);
  const mana = calculateMana(state, command.playerId, card.attribute, context);
  if (mana.available < 0) {
    return commandError("INSUFFICIENT_MANA", "連鎖後のみなもとが不足します。");
  }
  events.push({
    type: "CARD_CHAINED",
    playerId: command.playerId,
    groupId: group.groupId,
    cardInstanceId: command.cardInstanceId,
  });
  return null;
}

function discardHandCard(
  state: GameState,
  command: DiscardHandCardCommand,
  context: GameEngineContext,
  events: DomainEvent[],
): GameCommandError | null {
  const phaseError = validatePlacementPlayer(state, command.playerId);
  if (phaseError !== null) {
    return phaseError;
  }
  const player = getRequiredPlayer(state, command.playerId);
  const definition = validateCardInHand(
    state,
    command.playerId,
    command.cardInstanceId,
    context,
  );
  if (isGameCommandError(definition)) {
    return definition;
  }
  if (definition.cardType === "mana") {
    return commandError(
      "INVALID_CARD_TYPE",
      "みなもとカードは手札から捨てられません。",
    );
  }

  removeCardFromHand(player, command.cardInstanceId);
  player.discardPile.push(command.cardInstanceId);
  events.push({
    type: "CARD_DISCARDED",
    playerId: command.playerId,
    cardInstanceId: command.cardInstanceId,
  });
  return null;
}

function playSupportCard(
  state: GameState,
  command: PlaySupportCardCommand,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
  events: DomainEvent[],
): GameCommandError | null {
  if (state.phase !== "support") {
    return commandError(
      "INVALID_PHASE",
      "現在はサポートフェーズではありません。",
    );
  }
  if (state.supportFinishedBy.includes(command.playerId)) {
    return commandError(
      "SUPPORT_ALREADY_FINISHED",
      "サポート終了を宣言した後はカードを使用できません。",
    );
  }
  const support = validateSupportCardInHand(
    state,
    command.playerId,
    command.cardInstanceId,
    context,
  );
  if (isGameCommandError(support)) {
    return support;
  }
  const effectInputs = validateEffectInputs(
    support.effects,
    command.effectInputs,
  );
  if (!effectInputs.valid) {
    return effectValidationError(effectInputs.error);
  }

  const player = getRequiredPlayer(state, command.playerId);
  const manaBeforePlay = calculateMana(
    state,
    command.playerId,
    support.attribute,
    context,
  );
  if (manaBeforePlay.available < support.cost) {
    return commandError(
      "INSUFFICIENT_MANA",
      "サポートカードのコストに必要なみなもとが不足しています。",
    );
  }

  removeCardFromHand(player, command.cardInstanceId);
  player.battlefield.supportZone.push({
    cardInstanceId: command.cardInstanceId,
    ownerId: command.playerId,
    playedRound: state.round,
    playedSequence: state.nextEventSequence + events.length,
    duration: support.duration,
  });
  events.push({
    type: "SUPPORT_CARD_PLAYED",
    playerId: command.playerId,
    cardInstanceId: command.cardInstanceId,
  });

  for (const effect of support.effects) {
    const input = effectInputs.inputsByEffectId.get(effect.effectId);
    if (input === undefined) {
      return commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        `効果ID ${effect.effectId} の入力を取得できません。`,
      );
    }
    const planningState = deepFreeze(cloneGameState(state));
    const effectContext: EffectContext = {
      state: planningState,
      rules: context.rules,
      cardCatalog: context.cardCatalog,
      sourceCardInstanceId: command.cardInstanceId,
      sourceCardDefinitionId: support.id,
      ownerId: command.playerId,
      input,
      currentRound: state.round,
    };
    const planning = planCardEffect(
      effectContext,
      effect,
      context.effectRegistry,
    );
    if (!planning.planned) {
      return effectValidationError(planning.error);
    }

    events.push({
      type: "CARD_EFFECT_ACTIVATED",
      sourceCardInstanceId: command.cardInstanceId,
      effectId: effect.effectId,
      ownerId: command.playerId,
    });
    const application = applyEffectResolutionPlan(
      state,
      planning.plan,
      context,
      dependencies,
    );
    if (!application.applied) {
      return effectValidationError(application.error);
    }
    events.push(...application.events);
    events.push({
      type: "CARD_EFFECT_RESOLVED",
      sourceCardInstanceId: command.cardInstanceId,
      effectId: effect.effectId,
    });
  }

  if (support.duration === "instant") {
    if (
      state.activeEffects.some(
        (effect) => effect.sourceCardInstanceId === command.cardInstanceId,
      )
    ) {
      return commandError(
        "EFFECT_VALIDATION_FAILED",
        "instantサポートカードは継続効果を登録できません。",
      );
    }
    if (
      player.battlefield.supportZone.some(
        (card) => card.cardInstanceId === command.cardInstanceId,
      )
    ) {
      removeSupportCardFromField(player, command.cardInstanceId);
      player.discardPile.push(command.cardInstanceId);
      events.push({
        type: "SUPPORT_CARD_REMOVED",
        playerId: command.playerId,
        cardInstanceId: command.cardInstanceId,
      });
    }
  }

  const manaAfterPlay = calculateMana(
    state,
    command.playerId,
    support.attribute,
    context,
  );
  return manaAfterPlay.available < 0
    ? commandError(
        "INSUFFICIENT_MANA",
        "サポートカード使用後のみなもとが不足します。",
      )
    : null;
}

function finishPlacement(
  state: GameState,
  command: FinishPlacementCommand,
  receivedAt: number,
  context: GameEngineContext,
  events: DomainEvent[],
): GameCommandError | null {
  const phaseError = validatePlacementPlayer(state, command.playerId);
  if (phaseError !== null) {
    return phaseError;
  }
  advancePlacementPhase(state, receivedAt, context, events);
  return null;
}

function finishSupport(
  state: GameState,
  command: FinishSupportCommand,
  receivedAt: number,
  context: GameEngineContext,
  events: DomainEvent[],
): GameCommandError | null {
  if (state.phase !== "support") {
    return commandError(
      "INVALID_PHASE",
      "現在はサポートフェーズではありません。",
    );
  }
  if (state.supportFinishedBy.includes(command.playerId)) {
    return commandError(
      "SUPPORT_ALREADY_FINISHED",
      "すでにサポート終了を宣言しています。",
    );
  }

  state.supportFinishedBy.push(command.playerId);
  events.push({ type: "SUPPORT_FINISHED", playerId: command.playerId });
  if (
    state.playerOrder.every((playerId) =>
      state.supportFinishedBy.includes(playerId),
    )
  ) {
    events.push({ type: "SUPPORT_PHASE_ENDED" });
    resolveRound(state, receivedAt, context, events);
  }
  return null;
}

function executeTimeout(
  state: GameState,
  command: HandlePhaseTimeoutCommand,
  receivedAt: number,
  context: GameEngineContext,
): ExecuteCommandResult {
  if (
    command.phaseSequence !== state.phaseSequence ||
    state.status !== "active"
  ) {
    return { accepted: true, state, events: [] };
  }
  if (state.phaseDeadlineAt === null || receivedAt < state.phaseDeadlineAt) {
    return { accepted: true, state, events: [] };
  }
  if (
    state.phase !== "firstPlayerPlacement" &&
    state.phase !== "secondPlayerPlacement" &&
    state.phase !== "support"
  ) {
    return { accepted: true, state, events: [] };
  }

  const candidate = cloneGameState(state);
  const events: DomainEvent[] = [];
  try {
    if (candidate.phase === "support") {
      events.push({ type: "SUPPORT_PHASE_ENDED" });
      resolveRound(candidate, receivedAt, context, events);
    } else {
      advancePlacementPhase(candidate, receivedAt, context, events);
    }
    return commit(state, candidate, events, receivedAt, context);
  } catch (error) {
    return reject(
      state,
      commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        error instanceof Error
          ? error.message
          : "タイムアウト処理に失敗しました。",
      ),
    );
  }
}

function advancePlacementPhase(
  state: GameState,
  receivedAt: number,
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  if (state.phase === "firstPlayerPlacement") {
    transitionPhase(
      state,
      "secondPlayerPlacement",
      receivedAt,
      context,
      events,
    );
    return;
  }
  transitionPhase(state, "support", receivedAt, context, events);
}

function resolveRound(
  state: GameState,
  receivedAt: number,
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  transitionPhase(state, "resolution", receivedAt, context, events);
  const playerAId = state.playerOrder[0];
  const playerBId = state.playerOrder[1];
  const playerA = getRequiredPlayer(state, playerAId);
  const playerB = getRequiredPlayer(state, playerBId);
  const totalPowers = {
    [playerAId]: calculateTotalPower(state, playerAId, context),
    [playerBId]: calculateTotalPower(state, playerBId, context),
  };
  events.push({ type: "POWER_CALCULATED", playerPowers: totalPowers });

  const staminaBefore = {
    [playerAId]: playerA.stamina,
    [playerBId]: playerB.stamina,
  };
  const higherPowerPlayerId = resolveScore(state, totalPowers, events);
  const staminaAfter = {
    [playerAId]: playerA.stamina,
    [playerBId]: playerB.stamina,
  };
  const normalWinner = resolveStaminaWinner(playerA, playerB);

  if (normalWinner !== null) {
    cleanupRound(state, context, events);
    const result = createRoundResult(
      state,
      totalPowers,
      staminaBefore,
      staminaAfter,
      higherPowerPlayerId,
      null,
    );
    state.lastRoundResult = result;
    events.push({ type: "ROUND_RESOLVED", result });
    finishGame(state, normalWinner, receivedAt, events);
    return;
  }

  if (state.round >= context.rules.maxRounds) {
    cleanupRound(state, context, events);
    const winner = resolveMaxRoundWinner(playerA, playerB, totalPowers);
    const result = createRoundResult(
      state,
      totalPowers,
      staminaBefore,
      staminaAfter,
      higherPowerPlayerId,
      null,
    );
    state.lastRoundResult = result;
    events.push({ type: "ROUND_RESOLVED", result });
    finishGame(state, winner, receivedAt, events);
    return;
  }

  transitionPhase(state, "cleanup", receivedAt, context, events);
  cleanupRound(state, context, events);
  transitionPhase(state, "refill", receivedAt, context, events);

  if (playerA.deck.length === 0 || playerB.deck.length === 0) {
    const winner = resolveDeckOutWinner(playerA, playerB);
    const result = createRoundResult(
      state,
      totalPowers,
      staminaBefore,
      staminaAfter,
      higherPowerPlayerId,
      null,
    );
    state.lastRoundResult = result;
    events.push({ type: "ROUND_RESOLVED", result });
    finishGame(state, winner, receivedAt, events);
    return;
  }

  refillHands(state, context, events);
  const nextFirstPlayerId = determineNextFirstPlayer(state, totalPowers);
  const result = createRoundResult(
    state,
    totalPowers,
    staminaBefore,
    staminaAfter,
    higherPowerPlayerId,
    nextFirstPlayerId,
  );
  state.lastRoundResult = result;
  events.push({ type: "ROUND_RESOLVED", result });

  const nextSecondPlayerId =
    nextFirstPlayerId === playerAId ? playerBId : playerAId;
  state.round += 1;
  state.firstPlayerId = nextFirstPlayerId;
  state.secondPlayerId = nextSecondPlayerId;
  events.push({
    type: "ROUND_STARTED",
    round: state.round,
    firstPlayerId: nextFirstPlayerId,
    secondPlayerId: nextSecondPlayerId,
  });
  transitionPhase(state, "firstPlayerPlacement", receivedAt, context, events);
}

function resolveScore(
  state: GameState,
  totalPowers: Record<PlayerId, number>,
  events: DomainEvent[],
): PlayerId | null {
  const playerAId = state.playerOrder[0];
  const playerBId = state.playerOrder[1];
  const playerAPower = totalPowers[playerAId];
  const playerBPower = totalPowers[playerBId];
  if (
    playerAPower === undefined ||
    playerBPower === undefined ||
    playerAPower === playerBPower
  ) {
    return null;
  }

  const higherPlayerId = playerAPower > playerBPower ? playerAId : playerBId;
  const lowerPlayerId = higherPlayerId === playerAId ? playerBId : playerAId;
  const damage = Math.abs(playerAPower - playerBPower);
  const lowerPlayer = getRequiredPlayer(state, lowerPlayerId);
  const before = lowerPlayer.stamina;
  lowerPlayer.stamina -= damage;
  events.push({
    type: "STAMINA_CHANGED",
    playerId: lowerPlayerId,
    before,
    after: lowerPlayer.stamina,
  });
  return higherPlayerId;
}

function cleanupRound(
  state: GameState,
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  const expiredEffects = state.activeEffects.filter(
    (effect) => effect.duration === "untilRoundEnd",
  );
  state.activeEffects = state.activeEffects.filter(
    (effect) => effect.duration !== "untilRoundEnd",
  );
  for (const effect of expiredEffects) {
    events.push({
      type: "ACTIVE_EFFECT_REMOVED",
      effectInstanceId: effect.effectInstanceId,
      reason: "durationEnded",
    });
  }
  for (const player of Object.values(state.players)) {
    const retainedSupports = [];
    for (const support of player.battlefield.supportZone) {
      if (support.duration === "permanent") {
        retainedSupports.push(support);
      } else {
        player.discardPile.push(support.cardInstanceId);
        events.push({
          type: "SUPPORT_CARD_REMOVED",
          playerId: player.playerId,
          cardInstanceId: support.cardInstanceId,
        });
      }
    }
    player.battlefield.supportZone = retainedSupports;
    for (const attribute of attributes) {
      calculateMana(state, player.playerId, attribute, context);
    }
  }
  state.supportFinishedBy = [];
}

function refillHands(
  state: GameState,
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  for (const player of Object.values(state.players)) {
    const count = Math.min(
      Math.max(0, context.rules.handLimit - player.hand.length),
      player.deck.length,
    );
    if (count === 0) {
      continue;
    }
    const drawnCardIds = player.deck.splice(0, count);
    player.hand.push(...drawnCardIds);
    events.push({
      type: "CARDS_DRAWN",
      playerId: player.playerId,
      reason: "refill",
      cardInstanceIds: drawnCardIds,
    });
    processDrawnMana(state, player, drawnCardIds, context, events);
  }
}

function processDrawnMana(
  state: GameState,
  player: PlayerState,
  drawnCardIds: readonly CardInstanceId[],
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  const gainedByAttribute: Record<Attribute, number> = {
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
    if (definition?.cardType !== "mana") {
      continue;
    }
    removeCardFromHand(player, cardInstanceId);
    player.discardPile.push(cardInstanceId);
    player.mana[definition.attribute].total += definition.manaAmount;
    gainedByAttribute[definition.attribute] += definition.manaAmount;
  }
  for (const attribute of attributes) {
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
}

function createRoundResult(
  state: GameState,
  totalPowers: Record<PlayerId, number>,
  staminaBefore: Record<PlayerId, number>,
  staminaAfter: Record<PlayerId, number>,
  higherPowerPlayerId: PlayerId | null,
  nextFirstPlayerId: PlayerId | null,
): RoundResult {
  return {
    round: state.round,
    firstPlayerId: state.firstPlayerId,
    secondPlayerId: state.secondPlayerId,
    totalPowers,
    staminaBefore,
    staminaAfter,
    higherPowerPlayerId,
    nextFirstPlayerId,
  };
}

function determineNextFirstPlayer(
  state: GameState,
  totalPowers: Record<PlayerId, number>,
): PlayerId {
  const firstPower = totalPowers[state.firstPlayerId];
  const secondPower = totalPowers[state.secondPlayerId];
  if (firstPower === undefined || secondPower === undefined) {
    throw new Error("ラウンド結果の総パワーが不正です。");
  }
  if (firstPower === secondPower) {
    return state.secondPlayerId;
  }
  return firstPower > secondPower ? state.firstPlayerId : state.secondPlayerId;
}

function resolveStaminaWinner(
  playerA: PlayerState,
  playerB: PlayerState,
): GameWinner | null {
  if (playerA.stamina <= 0 && playerB.stamina <= 0) {
    return { type: "draw", reason: "bothStaminaZero" };
  }
  if (playerA.stamina <= 0) {
    return { type: "player", playerId: playerB.playerId, reason: "stamina" };
  }
  if (playerB.stamina <= 0) {
    return { type: "player", playerId: playerA.playerId, reason: "stamina" };
  }
  return null;
}

function resolveDeckOutWinner(
  playerA: PlayerState,
  playerB: PlayerState,
): GameWinner {
  if (playerA.stamina === playerB.stamina) {
    return { type: "draw", reason: "deckOutEqualStamina" };
  }
  return {
    type: "player",
    playerId:
      playerA.stamina > playerB.stamina ? playerA.playerId : playerB.playerId,
    reason: "deckOut",
  };
}

function resolveMaxRoundWinner(
  playerA: PlayerState,
  playerB: PlayerState,
  totalPowers: Record<PlayerId, number>,
): GameWinner {
  if (playerA.stamina !== playerB.stamina) {
    return {
      type: "player",
      playerId:
        playerA.stamina > playerB.stamina ? playerA.playerId : playerB.playerId,
      reason: "maxRoundStamina",
    };
  }
  const playerAPower = totalPowers[playerA.playerId];
  const playerBPower = totalPowers[playerB.playerId];
  if (playerAPower === undefined || playerBPower === undefined) {
    throw new Error("第30ラウンドの総パワーが不正です。");
  }
  if (playerAPower === playerBPower) {
    return { type: "draw", reason: "maxRoundEqual" };
  }
  return {
    type: "player",
    playerId: playerAPower > playerBPower ? playerA.playerId : playerB.playerId,
    reason: "maxRoundPower",
  };
}

function finishGame(
  state: GameState,
  winner: GameWinner,
  receivedAt: number,
  events: DomainEvent[],
): void {
  state.status = "finished";
  state.phase = "finished";
  state.phaseSequence += 1;
  state.phaseStartedAt = receivedAt;
  state.phaseDeadlineAt = null;
  state.winner = winner;
  events.push({
    type: "PHASE_CHANGED",
    phase: "finished",
    phaseSequence: state.phaseSequence,
    deadlineAt: null,
  });
  events.push({ type: "GAME_FINISHED", winner });
}

function transitionPhase(
  state: GameState,
  phase: GamePhase,
  receivedAt: number,
  context: GameEngineContext,
  events: DomainEvent[],
): void {
  state.phase = phase;
  state.phaseSequence += 1;
  state.phaseStartedAt = receivedAt;
  state.phaseDeadlineAt = getPhaseDeadline(phase, receivedAt, context);
  events.push({
    type: "PHASE_CHANGED",
    phase,
    phaseSequence: state.phaseSequence,
    deadlineAt: state.phaseDeadlineAt,
  });
}

function getPhaseDeadline(
  phase: GamePhase,
  startedAt: number,
  context: GameEngineContext,
): number | null {
  switch (phase) {
    case "firstPlayerPlacement":
    case "secondPlayerPlacement":
      return startedAt + context.rules.placementTimeLimitMs;
    case "support":
      return startedAt + context.rules.supportTimeLimitMs;
    default:
      return null;
  }
}

function validatePlacementPlayer(
  state: GameState,
  playerId: PlayerId,
): GameCommandError | null {
  const currentPlayerId = getPlacementPlayerId(state);
  if (currentPlayerId === null) {
    return commandError("INVALID_PHASE", "現在は配置フェーズではありません。");
  }
  return currentPlayerId === playerId
    ? null
    : commandError(
        "NOT_CURRENT_PLAYER",
        "現在の配置プレイヤーではありません。",
      );
}

function getPlacementPlayerId(state: GameState): PlayerId | null {
  if (state.phase === "firstPlayerPlacement") {
    return state.firstPlayerId;
  }
  if (state.phase === "secondPlayerPlacement") {
    return state.secondPlayerId;
  }
  return null;
}

function validateAttackCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  context: GameEngineContext,
):
  | DeepReadonly<Extract<CardDefinition, { cardType: "attack" }>>
  | GameCommandError {
  const definition = validateCardInHand(
    state,
    playerId,
    cardInstanceId,
    context,
  );
  if (isGameCommandError(definition)) {
    return definition;
  }
  return definition.cardType === "attack"
    ? definition
    : commandError("INVALID_CARD_TYPE", "攻撃カードを指定してください。");
}

function validateSupportCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  context: GameEngineContext,
):
  | DeepReadonly<Extract<CardDefinition, { cardType: "support" }>>
  | GameCommandError {
  const definition = validateCardInHand(
    state,
    playerId,
    cardInstanceId,
    context,
  );
  if (isGameCommandError(definition)) {
    return definition;
  }
  return definition.cardType === "support"
    ? definition
    : commandError("INVALID_CARD_TYPE", "サポートカードを指定してください。");
}

function validateCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  context: GameEngineContext,
): DeepReadonly<CardDefinition> | GameCommandError {
  const player = getPlayer(state, playerId);
  if (player === undefined) {
    return commandError("INVALID_TARGET", "操作プレイヤーが存在しません。");
  }
  const instance = state.cardInstances[cardInstanceId];
  if (instance === undefined) {
    return commandError(
      "CARD_NOT_FOUND",
      "カードインスタンスが見つかりません。",
    );
  }
  if (instance.ownerId !== playerId || !player.hand.includes(cardInstanceId)) {
    return commandError(
      "CARD_NOT_IN_HAND",
      "指定カードは操作プレイヤーの手札にありません。",
    );
  }
  const definition = getCardDefinitionForInstance(
    state,
    cardInstanceId,
    context,
  );
  return (
    definition ?? commandError("CARD_NOT_FOUND", "カード定義が見つかりません。")
  );
}

function createAttackGroupId(
  state: GameState,
  command: PlaceAttackCardCommand,
  dependencies: GameEngineDependencies,
): AttackGroupId | GameCommandError {
  const groupId = dependencies.idGenerator.generate({
    kind: "attackGroup",
    gameId: state.gameId,
    seed: `${command.commandId}:group`,
  });
  if (typeof groupId !== "string" || groupId.trim().length === 0) {
    return commandError(
      "INTERNAL_INVARIANT_VIOLATION",
      "攻撃グループIDが不正です。",
    );
  }
  const alreadyExists = Object.values(state.players).some((player) =>
    player.battlefield.attackGroups.some((group) => group.groupId === groupId),
  );
  return alreadyExists
    ? commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        "攻撃グループIDが重複しました。",
      )
    : groupId;
}

function removeCardFromHand(
  player: PlayerState,
  cardInstanceId: CardInstanceId,
): void {
  const index = player.hand.indexOf(cardInstanceId);
  if (index < 0) {
    throw new Error(`手札にカード ${cardInstanceId} がありません。`);
  }
  player.hand.splice(index, 1);
}

function removeSupportCardFromField(
  player: PlayerState,
  cardInstanceId: CardInstanceId,
): void {
  const index = player.battlefield.supportZone.findIndex(
    (card) => card.cardInstanceId === cardInstanceId,
  );
  if (index < 0) {
    throw new Error(`サポートゾーンにカード ${cardInstanceId} がありません。`);
  }
  player.battlefield.supportZone.splice(index, 1);
}

function getRequiredPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = getPlayer(state, playerId);
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }
  return player;
}

function commit(
  originalState: GameState,
  candidate: GameState,
  events: DomainEvent[],
  receivedAt: number,
  context: GameEngineContext,
): ExecuteCommandResult {
  candidate.stateVersion = originalState.stateVersion + 1;
  const firstEventSequence = candidate.nextEventSequence;
  candidate.nextEventSequence += events.length;
  const validation = validateGameState(candidate, context);
  if (!validation.valid) {
    return reject(
      originalState,
      commandError(
        "INTERNAL_INVARIANT_VIOLATION",
        "コマンド適用後の状態が不変条件を満たしていません。",
      ),
    );
  }
  const envelopes: GameEventEnvelope[] = events.map((event, index) => ({
    sequence: firstEventSequence + index,
    stateVersion: candidate.stateVersion,
    occurredAt: receivedAt,
    event,
  }));
  return { accepted: true, state: candidate, events: envelopes };
}

function cloneGameState(state: GameState): GameState {
  const players: Record<PlayerId, PlayerState> = Object.create(null);
  for (const [playerId, player] of Object.entries(state.players)) {
    players[playerId] = {
      ...player,
      deck: [...player.deck],
      hand: [...player.hand],
      discardPile: [...player.discardPile],
      mana: {
        attributeA: { ...player.mana.attributeA },
        attributeB: { ...player.mana.attributeB },
        attributeC: { ...player.mana.attributeC },
      },
      battlefield: {
        attackGroups: player.battlefield.attackGroups.map((group) => ({
          ...group,
          cardIds: [...group.cardIds],
        })),
        supportZone: player.battlefield.supportZone.map((support) => ({
          ...support,
        })),
      },
    };
  }
  const cardInstances: GameState["cardInstances"] = Object.create(null);
  for (const [cardInstanceId, instance] of Object.entries(
    state.cardInstances,
  )) {
    cardInstances[cardInstanceId] = { ...instance };
  }

  return {
    ...state,
    playerOrder: [...state.playerOrder],
    players,
    cardInstances,
    activeEffects: state.activeEffects.map((effect) => ({
      ...effect,
      target: { ...effect.target },
    })),
    supportFinishedBy: [...state.supportFinishedBy],
    lastRoundResult:
      state.lastRoundResult === null
        ? null
        : {
            ...state.lastRoundResult,
            totalPowers: { ...state.lastRoundResult.totalPowers },
            staminaBefore: { ...state.lastRoundResult.staminaBefore },
            staminaAfter: { ...state.lastRoundResult.staminaAfter },
          },
    winner: state.winner === null ? null : { ...state.winner },
    processedCommandIds: [...state.processedCommandIds],
  };
}

function commandError(
  code: GameCommandErrorCode,
  message: string,
  details?: GameCommandError["details"],
): GameCommandError {
  return details === undefined ? { code, message } : { code, message, details };
}

function effectValidationError(error: {
  code: string;
  message: string;
}): GameCommandError {
  return commandError("EFFECT_VALIDATION_FAILED", error.message, {
    effectErrorCode: error.code,
  });
}

function reject(
  state: GameState,
  error: GameCommandError,
): ExecuteCommandResult {
  return { accepted: false, state, error };
}

function isGameCommandError(value: unknown): value is GameCommandError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}
