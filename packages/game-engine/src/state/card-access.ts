import type {
  CardCatalog,
  CardDefinition,
} from "../contracts/card-definition.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type { GameEngineContext } from "../contracts/engine.js";
import type {
  CardInstance,
  GameState,
  PlayerState,
} from "../contracts/game-state.js";
import type {
  CardDefinitionId,
  CardInstanceId,
  PlayerId,
} from "../contracts/identifiers.js";

export function getPlayer(
  state: GameState,
  playerId: PlayerId,
): PlayerState | undefined {
  return state.players[playerId];
}

export function getCardInstance(
  state: GameState,
  cardInstanceId: CardInstanceId,
): CardInstance | undefined {
  return state.cardInstances[cardInstanceId];
}

export function getCardDefinition(
  catalog: CardCatalog,
  cardDefinitionId: CardDefinitionId,
): DeepReadonly<CardDefinition> | undefined {
  return catalog.definitions[cardDefinitionId];
}

export function getCardDefinitionForInstance(
  state: GameState,
  cardInstanceId: CardInstanceId,
  context: GameEngineContext,
): DeepReadonly<CardDefinition> | undefined {
  const instance = getCardInstance(state, cardInstanceId);
  return instance === undefined
    ? undefined
    : getCardDefinition(context.cardCatalog, instance.definitionId);
}
