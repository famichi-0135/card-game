import {
  learningArticles,
  selectLearningArticles,
} from "@disastar/learning-content";
import type {
  CardDefinitionId,
  PlayerId,
} from "@disastar/game-engine/contracts";
import type {
  GameLearningContextResponse,
  GameLearningSelectedCard,
} from "@disastar/contracts/game";

const MAX_SELECTED_CARDS_PER_PLAYER = 2;

export type PlayedGameCard = {
  cardDefinitionId: CardDefinitionId;
  cardName: string;
  playerId: PlayerId;
  sequence: number;
};

export type GameLearningContext = GameLearningContextResponse & {
  cardsByPlayer: Array<{
    playerId: PlayerId;
    cardDefinitionIds: CardDefinitionId[];
  }>;
};

export function createGameLearningContext({
  createdAt,
  gameId,
  playedCards,
  playerIds,
}: {
  createdAt: number;
  gameId: string;
  playedCards: readonly PlayedGameCard[];
  playerIds: readonly PlayerId[];
}): GameLearningContext {
  const selectedCardsByPlayer = playerIds.map((playerId) => ({
    playerId,
    cardDefinitionIds: selectPlayerCardDefinitionIds(playerId, playedCards),
  }));
  const selectedCardIds = new Set(
    selectedCardsByPlayer.flatMap(({ cardDefinitionIds }) => cardDefinitionIds),
  );

  return {
    gameId,
    createdAt,
    cardsByPlayer: selectedCardsByPlayer,
    selectedCards: createSelectedCards(playedCards, selectedCardIds, playerIds),
  };
}

function selectPlayerCardDefinitionIds(
  playerId: PlayerId,
  playedCards: readonly PlayedGameCard[],
): CardDefinitionId[] {
  const selected: CardDefinitionId[] = [];
  const seenCardIds = new Set<CardDefinitionId>();

  for (const playedCard of [...playedCards].sort(
    (left, right) => right.sequence - left.sequence,
  )) {
    if (
      playedCard.playerId !== playerId ||
      seenCardIds.has(playedCard.cardDefinitionId) ||
      !hasRelatedLearningArticle(playedCard.cardDefinitionId)
    ) {
      continue;
    }
    seenCardIds.add(playedCard.cardDefinitionId);
    selected.push(playedCard.cardDefinitionId);
    if (selected.length === MAX_SELECTED_CARDS_PER_PLAYER) {
      break;
    }
  }

  return selected;
}

function createSelectedCards(
  playedCards: readonly PlayedGameCard[],
  selectedCardIds: ReadonlySet<CardDefinitionId>,
  playerIds: readonly PlayerId[],
): GameLearningSelectedCard[] {
  const mostRecentCards = new Map<CardDefinitionId, PlayedGameCard>();
  for (const playedCard of playedCards) {
    if (!selectedCardIds.has(playedCard.cardDefinitionId)) {
      continue;
    }
    const current = mostRecentCards.get(playedCard.cardDefinitionId);
    if (current === undefined || current.sequence < playedCard.sequence) {
      mostRecentCards.set(playedCard.cardDefinitionId, playedCard);
    }
  }

  return [...mostRecentCards.values()]
    .sort((left, right) => right.sequence - left.sequence)
    .map((playedCard) => ({
      cardDefinitionId: playedCard.cardDefinitionId,
      cardName: playedCard.cardName,
      usedByPlayerIds: playerIds.filter((playerId) =>
        playedCards.some(
          (candidate) =>
            candidate.playerId === playerId &&
            candidate.cardDefinitionId === playedCard.cardDefinitionId,
        ),
      ),
    }));
}

function hasRelatedLearningArticle(
  cardDefinitionId: CardDefinitionId,
): boolean {
  return (
    selectLearningArticles([cardDefinitionId], learningArticles).length > 0
  );
}
