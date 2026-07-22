import type { GameEngineContext } from "../contracts/engine.js";
import type { ActiveEffect } from "../contracts/effects.js";
import type { EffectTarget } from "../contracts/effect-target.js";
import type {
  CardInstance,
  GameState,
  PlayerState,
  StateValidationIssue,
  StateValidationResult,
} from "../contracts/game-state.js";
import type { CardInstanceId, PlayerId } from "../contracts/identifiers.js";
import { calculateMana } from "../mana/calculate-mana.js";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;

export function validateGameState(
  state: GameState,
  context: GameEngineContext,
): StateValidationResult {
  const issues: StateValidationIssue[] = [];
  const playerIds = Object.keys(state.players);

  validateVersions(state, context, issues);
  validateSequences(state, issues);
  validatePlayers(state, playerIds, context, issues);
  validateCardInstances(state, playerIds, context, issues);
  validateCardLocations(state, playerIds, context, issues);
  validateActiveEffects(state, issues);
  validateFinishedState(state, issues);

  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}

function validateActiveEffects(
  state: GameState,
  issues: StateValidationIssue[],
): void {
  const effectInstanceIds = new Set<string>();
  const appliedSequences = new Set<number>();
  let highestAppliedSequence = 0;

  for (const effect of state.activeEffects) {
    if (
      typeof effect.effectInstanceId !== "string" ||
      effect.effectInstanceId.length === 0 ||
      effectInstanceIds.has(effect.effectInstanceId)
    ) {
      issues.push({
        code: "INVALID_ACTIVE_EFFECT_ID",
        message: "継続効果の識別子が空または重複しています。",
      });
    }
    effectInstanceIds.add(effect.effectInstanceId);

    const sourceCard = state.cardInstances[effect.sourceCardInstanceId];
    const owner = state.players[effect.ownerId];
    if (
      sourceCard === undefined ||
      sourceCard.ownerId !== effect.ownerId ||
      owner === undefined ||
      !isCardOnBattlefield(owner, effect.sourceCardInstanceId)
    ) {
      issues.push({
        code: "ACTIVE_EFFECT_SOURCE_NOT_ON_FIELD",
        message: "継続効果の効果元カードが場に存在しません。",
      });
    }

    if (!targetExists(state, effect.target)) {
      issues.push({
        code: "ACTIVE_EFFECT_TARGET_NOT_FOUND",
        message: "継続効果の対象が現在の状態に存在しません。",
      });
    }
    if (!isTargetCompatibleWithScope(effect)) {
      issues.push({
        code: "INVALID_ACTIVE_EFFECT_TARGET",
        message: "継続効果の対象種別と攻撃力スコープが一致しません。",
      });
    }
    if (
      !Number.isFinite(effect.value) ||
      !["overwrite", "add", "multiply"].includes(effect.operation) ||
      !["untilRoundEnd", "whileSourceOnField"].includes(effect.duration) ||
      !Number.isSafeInteger(effect.appliedSequence) ||
      effect.appliedSequence < 1 ||
      !Number.isSafeInteger(effect.appliedRound) ||
      effect.appliedRound < 1
    ) {
      issues.push({
        code: "INVALID_ACTIVE_EFFECT",
        message: "継続効果の設定または適用順序が不正です。",
      });
    } else if (appliedSequences.has(effect.appliedSequence)) {
      issues.push({
        code: "INVALID_ACTIVE_EFFECT_SEQUENCE",
        message: "継続効果の適用シーケンスが重複しています。",
      });
    } else {
      appliedSequences.add(effect.appliedSequence);
      highestAppliedSequence = Math.max(
        highestAppliedSequence,
        effect.appliedSequence,
      );
    }
  }

  if (state.nextEffectSequence <= highestAppliedSequence) {
    issues.push({
      code: "INVALID_ACTIVE_EFFECT_SEQUENCE",
      message: "次の継続効果シーケンスが登録済み効果より後ではありません。",
    });
  }
}

function isCardOnBattlefield(
  player: PlayerState,
  cardInstanceId: CardInstanceId,
): boolean {
  return (
    player.battlefield.attackGroups.some((group) =>
      group.cardIds.includes(cardInstanceId),
    ) ||
    player.battlefield.supportZone.some(
      (card) => card.cardInstanceId === cardInstanceId,
    )
  );
}

function targetExists(state: GameState, target: EffectTarget): boolean {
  switch (target.type) {
    case "player":
    case "mana":
      return state.players[target.playerId] !== undefined;
    case "attackGroup":
      return Object.values(state.players).some((player) =>
        player.battlefield.attackGroups.some(
          (group) => group.groupId === target.groupId,
        ),
      );
    case "attackCard":
      return Object.values(state.players).some((player) =>
        player.battlefield.attackGroups.some((group) =>
          group.cardIds.includes(target.cardInstanceId),
        ),
      );
    case "supportCard":
      return Object.values(state.players).some((player) =>
        player.battlefield.supportZone.some(
          (card) => card.cardInstanceId === target.cardInstanceId,
        ),
      );
  }
}

function isTargetCompatibleWithScope(effect: ActiveEffect): boolean {
  return (
    (effect.scope === "cardPower" && effect.target.type === "attackCard") ||
    (effect.scope === "groupPower" && effect.target.type === "attackGroup") ||
    (effect.scope === "totalPower" && effect.target.type === "player")
  );
}

function validateVersions(
  state: GameState,
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  if (
    state.rulesetVersion !== context.rules.version ||
    state.cardCatalogVersion !== context.cardCatalog.version ||
    state.engineSemanticsVersion !== context.engineSemanticsVersion
  ) {
    issues.push({
      code: "CONTEXT_VERSION_MISMATCH",
      message: "ゲーム状態とエンジンコンテキストのバージョンが一致しません。",
    });
  }
}

function validateSequences(
  state: GameState,
  issues: StateValidationIssue[],
): void {
  for (const [name, value, minimum] of [
    ["stateVersion", state.stateVersion, 0],
    ["phaseSequence", state.phaseSequence, 1],
    ["nextEffectSequence", state.nextEffectSequence, 0],
    ["nextEventSequence", state.nextEventSequence, 0],
    ["round", state.round, 1],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < minimum) {
      issues.push({
        code: "INVALID_SEQUENCE",
        message: `${name}は${minimum}以上の安全な整数でなければなりません。`,
      });
    }
  }

  if (!Number.isFinite(state.phaseStartedAt)) {
    issues.push({
      code: "INVALID_PHASE_TIME",
      message: "フェーズ開始時刻は有限数でなければなりません。",
    });
  }
  if (
    state.phaseDeadlineAt !== null &&
    !Number.isFinite(state.phaseDeadlineAt)
  ) {
    issues.push({
      code: "INVALID_PHASE_TIME",
      message: "フェーズ期限はnullまたは有限数でなければなりません。",
    });
  }
  if (
    ["firstPlayerPlacement", "secondPlayerPlacement", "support"].includes(
      state.phase,
    ) &&
    state.phaseDeadlineAt === null
  ) {
    issues.push({
      code: "MISSING_PHASE_DEADLINE",
      message: "操作可能フェーズには期限が必要です。",
    });
  }
}

function validatePlayers(
  state: GameState,
  playerIds: string[],
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  if (playerIds.length !== context.rules.playerCount) {
    issues.push({
      code: "INVALID_PLAYER_COUNT",
      message: "ゲーム状態のプレイヤー数がルールと一致しません。",
    });
  }

  const order = state.playerOrder;
  if (
    order[0] === order[1] ||
    !playerIds.includes(order[0]) ||
    !playerIds.includes(order[1]) ||
    state.firstPlayerId === state.secondPlayerId ||
    !playerIds.includes(state.firstPlayerId) ||
    !playerIds.includes(state.secondPlayerId)
  ) {
    issues.push({
      code: "INVALID_PLAYER_ORDER",
      message: "プレイヤー順または先攻・後攻が不正です。",
    });
  }

  const factions = playerIds.map(
    (playerId) => state.players[playerId]?.faction,
  );
  if (
    factions.filter((faction) => faction === "disaster").length !== 1 ||
    factions.filter((faction) => faction === "countermeasure").length !== 1
  ) {
    issues.push({
      code: "INVALID_FACTION_ASSIGNMENT",
      message: "ゲーム状態には災害側と対策側が1人ずつ必要です。",
    });
  }

  const finishedPlayers = new Set<PlayerId>();
  for (const playerId of state.supportFinishedBy) {
    if (!playerIds.includes(playerId) || finishedPlayers.has(playerId)) {
      issues.push({
        code: "INVALID_SUPPORT_FINISHED_BY",
        message: "サポート終了プレイヤーの記録が不正です。",
      });
    }
    finishedPlayers.add(playerId);
  }

  for (const playerId of playerIds) {
    const player = state.players[playerId];
    if (player === undefined) {
      issues.push({
        code: "PLAYER_NOT_FOUND",
        message: `プレイヤー ${playerId} が見つかりません。`,
      });
      continue;
    }
    validatePlayerState(state, player, context, issues);
  }
}

function validatePlayerState(
  state: GameState,
  player: PlayerState,
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  if (
    player.playerId !== undefined &&
    state.players[player.playerId] !== player
  ) {
    issues.push({
      code: "PLAYER_RECORD_KEY_MISMATCH",
      message: "プレイヤーRecordのキーとplayerIdが一致しません。",
    });
  }
  if (player.hand.length > context.rules.handLimit) {
    issues.push({
      code: "HAND_LIMIT_EXCEEDED",
      message: `プレイヤー ${player.playerId} の手札が上限を超えています。`,
    });
  }
  if (!Number.isSafeInteger(player.stamina)) {
    issues.push({
      code: "INVALID_STAMINA",
      message: `プレイヤー ${player.playerId} のスタミナが安全な整数ではありません。`,
    });
  }

  for (const attribute of attributes) {
    const mana = player.mana[attribute];
    if (
      mana === undefined ||
      !Number.isSafeInteger(mana.total) ||
      mana.total < 0
    ) {
      issues.push({
        code: "INVALID_MANA_TOTAL",
        message: `プレイヤー ${player.playerId} のみなもと総量が不正です。`,
      });
      continue;
    }
    try {
      const calculated = calculateMana(
        state,
        player.playerId,
        attribute,
        context,
      );
      if (calculated.reserved < 0 || calculated.available < 0) {
        issues.push({
          code: "INVALID_MANA_RESERVATION",
          message: `プレイヤー ${player.playerId} のみなもと予約量が不正です。`,
        });
      }
    } catch (error) {
      issues.push({
        code: "INVALID_MANA_RESERVATION",
        message:
          error instanceof Error
            ? error.message
            : "みなもと計算に失敗しました。",
      });
    }
  }

  if (player.battlefield.attackGroups.length > context.rules.maxAttackGroups) {
    issues.push({
      code: "ATTACK_GROUP_LIMIT_EXCEEDED",
      message: `プレイヤー ${player.playerId} の攻撃グループ数が上限を超えています。`,
    });
  }
}

function validateCardInstances(
  state: GameState,
  playerIds: string[],
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  const instances = Object.entries(state.cardInstances);
  if (instances.length !== context.rules.playerCount * context.rules.deckSize) {
    issues.push({
      code: "INVALID_CARD_INSTANCE_COUNT",
      message: "カードインスタンス数がルールと一致しません。",
    });
  }

  for (const [key, instance] of instances) {
    validateCardInstance(key, instance, state, playerIds, context, issues);
  }
}

function validateCardInstance(
  key: string,
  instance: CardInstance,
  state: GameState,
  playerIds: string[],
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  if (key !== instance.instanceId) {
    issues.push({
      code: "CARD_INSTANCE_KEY_MISMATCH",
      message: `カードインスタンス ${key} のRecordキーが一致しません。`,
    });
  }
  if (!playerIds.includes(instance.ownerId)) {
    issues.push({
      code: "INVALID_CARD_OWNER",
      message: `カードインスタンス ${key} の所有者が不正です。`,
    });
  }
  const definition = context.cardCatalog.definitions[instance.definitionId];
  if (definition === undefined) {
    issues.push({
      code: "CARD_DEFINITION_NOT_FOUND",
      message: `カードインスタンス ${key} の定義が見つかりません。`,
    });
  } else if (state.players[instance.ownerId]?.faction !== definition.faction) {
    issues.push({
      code: "CARD_FACTION_MISMATCH",
      message: `カードインスタンス ${key} の陣営が所有者と一致しません。`,
    });
  }
}

function validateCardLocations(
  state: GameState,
  playerIds: string[],
  context: GameEngineContext,
  issues: StateValidationIssue[],
): void {
  const locations = new Set<CardInstanceId>();
  const groupIds = new Set<string>();
  const addCards = (
    cardIds: readonly CardInstanceId[],
    ownerId: PlayerId,
    zone: string,
  ) => {
    for (const cardInstanceId of cardIds) {
      const instance = state.cardInstances[cardInstanceId];
      if (instance === undefined) {
        issues.push({
          code: "CARD_INSTANCE_NOT_FOUND",
          message: `${zone}に未知のカード ${cardInstanceId} があります。`,
        });
        continue;
      }
      if (instance.ownerId !== ownerId) {
        issues.push({
          code: "CARD_OWNER_MISMATCH",
          message: `${zone}のカード ${cardInstanceId} の所有者が一致しません。`,
        });
      }
      if (locations.has(cardInstanceId)) {
        issues.push({
          code: "DUPLICATE_CARD_LOCATION",
          message: `カード ${cardInstanceId} が複数の領域に存在します。`,
        });
      }
      locations.add(cardInstanceId);
    }
  };

  for (const playerId of playerIds) {
    const player = state.players[playerId];
    if (player === undefined) {
      continue;
    }
    addCards(player.deck, player.playerId, "山札");
    addCards(player.hand, player.playerId, "手札");
    addCards(player.discardPile, player.playerId, "捨て札");

    const occupiedSlots = new Set<number>();

    for (const group of player.battlefield.attackGroups) {
      if (groupIds.has(group.groupId) || group.cardIds.length === 0) {
        issues.push({
          code: "INVALID_ATTACK_GROUP",
          message: `攻撃グループ ${group.groupId} が重複または空です。`,
        });
      }
      groupIds.add(group.groupId);
      if (group.ownerId !== player.playerId) {
        issues.push({
          code: "ATTACK_GROUP_OWNER_MISMATCH",
          message: `攻撃グループ ${group.groupId} の所有者が一致しません。`,
        });
      }
      if (
        !Number.isSafeInteger(group.slotIndex) ||
        group.slotIndex < 0 ||
        group.slotIndex >= context.rules.maxAttackGroups ||
        occupiedSlots.has(group.slotIndex)
      ) {
        issues.push({
          code: "INVALID_ATTACK_GROUP_SLOT",
          message: `攻撃グループ ${group.groupId} の固定枠が不正または重複しています。`,
        });
      }
      occupiedSlots.add(group.slotIndex);
      addCards(group.cardIds, player.playerId, "攻撃グループ");
      for (const cardInstanceId of group.cardIds) {
        const instance = state.cardInstances[cardInstanceId];
        const definition =
          instance === undefined
            ? undefined
            : context.cardCatalog.definitions[instance.definitionId];
        if (
          definition?.cardType !== "attack" ||
          definition.attribute !== group.attribute
        ) {
          issues.push({
            code: "INVALID_ATTACK_GROUP_CARD",
            message: `攻撃グループ ${group.groupId} のカード属性または種別が不正です。`,
          });
        }
      }
    }

    for (const support of player.battlefield.supportZone) {
      addCards([support.cardInstanceId], player.playerId, "サポートゾーン");
      const instance = state.cardInstances[support.cardInstanceId];
      const definition =
        instance === undefined
          ? undefined
          : context.cardCatalog.definitions[instance.definitionId];
      if (
        definition?.cardType !== "support" ||
        definition.duration !== support.duration
      ) {
        issues.push({
          code: "INVALID_SUPPORT_CARD",
          message: "サポートゾーンのカードまたは継続期間が不正です。",
        });
      }
    }
  }

  if (locations.size !== Object.keys(state.cardInstances).length) {
    issues.push({
      code: "MISSING_CARD_LOCATION",
      message: "すべてのカードインスタンスがちょうど1つの領域に存在しません。",
    });
  }
}

function validateFinishedState(
  state: GameState,
  issues: StateValidationIssue[],
): void {
  if (
    state.status === "finished" &&
    (state.phase !== "finished" ||
      state.winner === null ||
      state.phaseDeadlineAt !== null)
  ) {
    issues.push({
      code: "INVALID_FINISHED_STATE",
      message: "終了済みゲームの状態が不正です。",
    });
  }
  if (state.status !== "finished" && state.winner !== null) {
    issues.push({
      code: "UNEXPECTED_WINNER",
      message: "進行中ゲームに勝者が設定されています。",
    });
  }
}
