import { validateDeck } from "@disastar/game-engine";
import type {
  CardDefinitionId,
  Faction,
  PlayerId,
} from "@disastar/game-engine/contracts";
import { gameEngineContext } from "../game-engine/runtime.js";
import { getPlayerDecksInEnvironment } from "./player-decks.js";

/**
 * 認証済みプレイヤー自身の保存済みデッキを取得し、現在のルールでも有効な場合だけ返す。
 * デッキが削除済み、またはカードカタログ更新で無効化された場合は対戦開始へ渡さない。
 */
export async function resolveAuthorizedDeckInEnvironment(
  playerId: PlayerId,
  deckId: string,
  environment: CloudflareBindings,
): Promise<AuthorizedDeck | null> {
  const deck = await getPlayerDecksInEnvironment(playerId, environment).get(
    deckId,
  );
  if (deck === null) {
    return null;
  }

  const validation = validateDeck(
    deck.cardDefinitionIds,
    deck.faction,
    gameEngineContext.cardCatalog,
    gameEngineContext.rules,
  );
  return validation.valid
    ? {
        faction: deck.faction,
        cardDefinitionIds: [...deck.cardDefinitionIds],
      }
    : null;
}

export type AuthorizedDeck = {
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
};
