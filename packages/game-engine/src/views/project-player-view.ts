import type {
  ActiveEffect,
  CardInstance,
  GameState,
  PlayerId,
  PlayerGameView,
  PlayerState,
  PublicPlayerState,
  VisibleAttackGroup,
  VisibleCardInstance,
} from "../contracts/index.js";

export function createPlayerView(
  state: GameState,
  viewerPlayerId: PlayerId,
): PlayerGameView {
  const viewer = state.players[viewerPlayerId];
  if (viewer === undefined) {
    throw new RangeError(
      `プレイヤー ${viewerPlayerId} はこのゲームに参加していません。`,
    );
  }

  const opponentPlayerId = state.playerOrder.find(
    (playerId) => playerId !== viewerPlayerId,
  );
  if (opponentPlayerId === undefined) {
    throw new Error("対戦相手を特定できません。");
  }
  const opponent = state.players[opponentPlayerId];
  if (opponent === undefined) {
    throw new Error(
      `プレイヤー ${opponentPlayerId} がゲーム状態に存在しません。`,
    );
  }

  return {
    gameId: state.gameId,
    rulesetVersion: state.rulesetVersion,
    cardCatalogVersion: state.cardCatalogVersion,
    stateVersion: state.stateVersion,
    status: state.status,
    round: state.round,
    phase: state.phase,
    phaseSequence: state.phaseSequence,
    phaseDeadlineAt: state.phaseDeadlineAt,
    firstPlayerId: state.firstPlayerId,
    secondPlayerId: state.secondPlayerId,
    viewerPlayerId,
    self: {
      ...createPublicPlayerState(state, viewer),
      hand: viewer.hand.map((cardInstanceId) =>
        toVisibleCard(state, cardInstanceId),
      ),
    },
    opponent: createPublicPlayerState(state, opponent),
    lastRoundResult: state.lastRoundResult,
    winner: state.winner,
  };
}

function createPublicPlayerState(
  state: GameState,
  player: PlayerState,
): PublicPlayerState {
  return {
    playerId: player.playerId,
    faction: player.faction,
    stamina: player.stamina,
    handCount: player.hand.length,
    deckCount: player.deck.length,
    discardPile: player.discardPile.map((cardInstanceId) =>
      toVisibleCard(state, cardInstanceId),
    ),
    attackGroups: player.battlefield.attackGroups.map((group) =>
      toVisibleAttackGroup(state, group),
    ),
    supportZone: player.battlefield.supportZone.map((support) =>
      toVisibleCard(state, support.cardInstanceId),
    ),
    mana: {
      attributeA: { ...player.mana.attributeA },
      attributeB: { ...player.mana.attributeB },
      attributeC: { ...player.mana.attributeC },
    },
    activeEffects: state.activeEffects
      .filter((effect) => effect.ownerId === player.playerId)
      .map(cloneActiveEffect),
    supportFinished: state.supportFinishedBy.includes(player.playerId),
  };
}

function toVisibleAttackGroup(
  state: GameState,
  group: GameState["players"][PlayerId]["battlefield"]["attackGroups"][number],
): VisibleAttackGroup {
  return {
    groupId: group.groupId,
    ownerId: group.ownerId,
    attribute: group.attribute,
    createdRound: group.createdRound,
    cards: group.cardIds.map((cardInstanceId) =>
      toVisibleCard(state, cardInstanceId),
    ),
  };
}

function toVisibleCard(
  state: GameState,
  cardInstanceId: CardInstance["instanceId"],
): VisibleCardInstance {
  const card = state.cardInstances[cardInstanceId];
  if (card === undefined) {
    throw new Error(`カードインスタンス ${cardInstanceId} が見つかりません。`);
  }
  return {
    instanceId: card.instanceId,
    definitionId: card.definitionId,
    ownerId: card.ownerId,
  };
}

function cloneActiveEffect(effect: ActiveEffect): ActiveEffect {
  return {
    ...effect,
    target: { ...effect.target },
  };
}
