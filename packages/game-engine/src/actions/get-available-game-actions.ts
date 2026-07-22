import type {
  AvailableAction,
  AvailableAttackChain,
  AvailableAttackPlacement,
  AvailableGameActions,
  AvailableHandCardActions,
  AvailableSupportEffectSelection,
  AvailableSupportPlay,
  GameActionUnavailableReasonCode,
  GetAvailableGameActionsInput,
} from "../contracts/available-game-actions.js";
import type { Attribute } from "../contracts/card-definition.js";
import type { EffectTarget } from "../contracts/effect-target.js";
import type { AttackGroupSlotIndex } from "../contracts/game-state.js";
import { ATTACK_GROUP_SLOT_INDICES } from "../contracts/game-state.js";
import type {
  CardDefinitionId,
  CardInstanceId,
  PlayerId,
} from "../contracts/identifiers.js";
import type {
  PublicCardDefinition,
  PublicCardEffectInteraction,
} from "../contracts/public-card-catalog.js";
import type {
  PlayerGameView,
  PublicPlayerState,
  VisibleAttackGroup,
} from "../contracts/views.js";
import { getPlacementPlayerId } from "./placement-phase.js";
import {
  canChainAttackCard,
  getAdditionalAttackGroupManaRequired,
  hasAvailableMana,
} from "./attack-availability.js";

const attributes: readonly Attribute[] = [
  "attributeA",
  "attributeB",
  "attributeC",
];

/**
 * 公開状態だけから、クライアントが操作 UI に表示してよい候補を求める。
 * サーバーは受信時刻と完全なゲーム状態で executeCommand を再検証する。
 */
export function getAvailableGameActions(
  input: GetAvailableGameActionsInput,
): AvailableGameActions {
  const { view, catalog, now } = input;
  const commonReason = getCommonUnavailableReason(view, catalog, now);
  const placementReason =
    commonReason ?? getPlacementUnavailableReason(view, view.viewerPlayerId);
  const supportReason =
    commonReason ?? getSupportUnavailableReason(view, view.viewerPlayerId);
  const openSlots = getOpenSlots(view.self.attackGroups);

  return {
    stateVersion: view.stateVersion,
    phaseSequence: view.phaseSequence,
    handCards: Object.fromEntries(
      view.self.hand.map((card) => {
        const definition = catalog.definitions[card.definitionId];
        return [
          card.instanceId,
          createHandCardActions(
            view,
            definition,
            card.instanceId,
            card.definitionId,
            catalog,
            placementReason,
            supportReason,
            openSlots,
          ),
        ];
      }),
    ),
    finishPlacement: toAvailability(placementReason),
    finishSupport: toAvailability(supportReason),
  };
}

function createHandCardActions(
  view: PlayerGameView,
  definition: PublicCardDefinition | undefined,
  cardInstanceId: CardInstanceId,
  cardDefinitionId: CardDefinitionId,
  catalog: GetAvailableGameActionsInput["catalog"],
  placementReason: GameActionUnavailableReasonCode | null,
  supportReason: GameActionUnavailableReasonCode | null,
  openSlots: AttackGroupSlotIndex[],
): AvailableHandCardActions {
  if (definition === undefined) {
    return {
      cardInstanceId,
      definitionId: cardDefinitionId,
      placeAttack: unavailablePlacement("CARD_DEFINITION_NOT_FOUND"),
      chainAttack: unavailableChain("CARD_DEFINITION_NOT_FOUND"),
      discard: unavailable("CARD_DEFINITION_NOT_FOUND"),
      playSupport: unavailableSupport("CARD_DEFINITION_NOT_FOUND"),
    };
  }

  return {
    cardInstanceId,
    definitionId: definition.id,
    placeAttack: getAttackPlacement(
      view,
      definition,
      placementReason,
      openSlots,
    ),
    chainAttack: getAttackChain(view, catalog, definition, placementReason),
    discard: getDiscard(definition, placementReason),
    playSupport: getSupportPlay(view, definition, supportReason),
  };
}

function getAttackPlacement(
  view: PlayerGameView,
  definition: PublicCardDefinition,
  placementReason: GameActionUnavailableReasonCode | null,
  openSlots: AttackGroupSlotIndex[],
): AvailableAttackPlacement {
  if (placementReason !== null) {
    return unavailablePlacement(placementReason);
  }
  if (definition.cardType !== "attack") {
    return unavailablePlacement("INVALID_CARD_TYPE");
  }
  if (view.self.attackGroups.length >= ATTACK_GROUP_SLOT_INDICES.length) {
    return unavailablePlacement("ATTACK_GROUP_LIMIT_REACHED");
  }
  if (openSlots.length === 0) {
    return unavailablePlacement("ATTACK_GROUP_SLOT_UNAVAILABLE");
  }
  if (
    !hasAvailableMana(
      view.self.mana[definition.attribute].available,
      definition.cost ?? 0,
    )
  ) {
    return unavailablePlacement("INSUFFICIENT_MANA");
  }
  return { available: true, slotIndices: openSlots };
}

function getAttackChain(
  view: PlayerGameView,
  catalog: GetAvailableGameActionsInput["catalog"],
  definition: PublicCardDefinition,
  placementReason: GameActionUnavailableReasonCode | null,
): AvailableAttackChain {
  if (placementReason !== null) {
    return unavailableChain(placementReason);
  }
  if (definition.cardType !== "attack") {
    return unavailableChain("INVALID_CARD_TYPE");
  }

  const candidates = view.self.attackGroups.filter((group) =>
    canChainToGroup(catalog, definition, group),
  );
  if (candidates.length === 0) {
    return unavailableChain("CHAIN_NOT_ALLOWED");
  }
  if (
    !candidates.some((group) =>
      hasAvailableMana(
        view.self.mana[definition.attribute].available,
        getAdditionalAttackGroupManaRequired(
          group.requiredMana,
          definition.cost ?? 0,
        ),
      ),
    )
  ) {
    return unavailableChain("INSUFFICIENT_MANA");
  }
  return {
    available: true,
    targetGroupIds: candidates
      .filter((group) =>
        hasAvailableMana(
          view.self.mana[definition.attribute].available,
          getAdditionalAttackGroupManaRequired(
            group.requiredMana,
            definition.cost ?? 0,
          ),
        ),
      )
      .map((group) => group.groupId),
  };
}

function canChainToGroup(
  catalog: GetAvailableGameActionsInput["catalog"],
  definition: PublicCardDefinition,
  group: VisibleAttackGroup,
): boolean {
  const topCard = group.cards.at(-1);
  if (topCard === undefined) {
    return false;
  }
  const topDefinition = catalog.definitions[topCard.definitionId];
  return (
    topDefinition !== undefined &&
    canChainAttackCard(
      group.attribute,
      definition.attribute,
      topDefinition.interaction.chainableCardDefinitionIds,
      definition.id,
    )
  );
}

function getDiscard(
  definition: PublicCardDefinition,
  placementReason: GameActionUnavailableReasonCode | null,
): AvailableAction {
  if (placementReason !== null) {
    return unavailable(placementReason);
  }
  return definition.cardType === "mana"
    ? unavailable("INVALID_CARD_TYPE")
    : { available: true };
}

function getSupportPlay(
  view: PlayerGameView,
  definition: PublicCardDefinition,
  supportReason: GameActionUnavailableReasonCode | null,
): AvailableSupportPlay {
  if (supportReason !== null) {
    return unavailableSupport(supportReason);
  }
  if (definition.cardType !== "support") {
    return unavailableSupport("INVALID_CARD_TYPE");
  }
  if (
    !hasAvailableMana(
      view.self.mana[definition.attribute].available,
      definition.cost ?? 0,
    )
  ) {
    return unavailableSupport("INSUFFICIENT_MANA");
  }

  const effectSelections = definition.interaction.effects.map((effect, index) =>
    createEffectSelection(view, effect, index),
  );
  if (
    effectSelections.some(
      (selection) => selection.candidates.length < selection.minTargets,
    )
  ) {
    return {
      ...unavailable("EFFECT_TARGET_UNAVAILABLE"),
      effectSelections,
    };
  }
  return { available: true, effectSelections };
}

function createEffectSelection(
  view: PlayerGameView,
  effect: PublicCardEffectInteraction,
  stageIndex: number,
): AvailableSupportEffectSelection {
  return {
    effectId: effect.effectId,
    stageIndex,
    required: effect.target.required,
    minTargets: effect.target.minTargets,
    maxTargets: effect.target.maxTargets,
    selectionOrder: effect.target.selectionOrder,
    candidates: getEffectTargetCandidates(view, effect),
  };
}

function getEffectTargetCandidates(
  view: PlayerGameView,
  effect: PublicCardEffectInteraction,
): EffectTarget[] {
  const players = getPlayersForSide(view, effect.target.side);
  const candidates: EffectTarget[] = [];

  for (const zone of effect.target.zones) {
    for (const player of players) {
      switch (zone) {
        case "attackGroup":
          candidates.push(
            ...player.attackGroups.map((group) => ({
              type: "attackGroup" as const,
              groupId: group.groupId,
            })),
          );
          break;
        case "attackCard":
          candidates.push(
            ...player.attackGroups.flatMap((group) =>
              group.cards.map((card) => ({
                type: "attackCard" as const,
                cardInstanceId: card.instanceId,
              })),
            ),
          );
          break;
        case "supportCard":
          candidates.push(
            ...player.supportZone.map((card) => ({
              type: "supportCard" as const,
              cardInstanceId: card.instanceId,
            })),
          );
          break;
        case "player":
          candidates.push({ type: "player", playerId: player.playerId });
          break;
        case "mana":
          candidates.push(
            ...attributes.map((attribute) => ({
              type: "mana" as const,
              playerId: player.playerId,
              attribute,
            })),
          );
          break;
      }
    }
  }
  return candidates;
}

function getPlayersForSide(
  view: PlayerGameView,
  side: PublicCardEffectInteraction["target"]["side"],
): PublicPlayerState[] {
  switch (side) {
    case "self":
      return [view.self];
    case "opponent":
      return [view.opponent];
    case "either":
      return [view.self, view.opponent];
  }
}

function getCommonUnavailableReason(
  view: PlayerGameView,
  catalog: GetAvailableGameActionsInput["catalog"],
  now: number,
): GameActionUnavailableReasonCode | null {
  if (catalog.version !== view.cardCatalogVersion) {
    return "CARD_CATALOG_VERSION_MISMATCH";
  }
  if (view.status !== "active") {
    return "GAME_NOT_ACTIVE";
  }
  if (
    !Number.isFinite(now) ||
    view.phaseDeadlineAt === null ||
    now > view.phaseDeadlineAt
  ) {
    return "PHASE_DEADLINE_EXPIRED";
  }
  return null;
}

function getPlacementUnavailableReason(
  view: PlayerGameView,
  playerId: PlayerId,
): GameActionUnavailableReasonCode | null {
  const placementPlayerId = getPlacementPlayerId(
    view.phase,
    view.firstPlayerId,
    view.secondPlayerId,
  );
  if (placementPlayerId === null) {
    return "INVALID_PHASE";
  }
  return placementPlayerId === playerId ? null : "NOT_CURRENT_PLAYER";
}

function getSupportUnavailableReason(
  view: PlayerGameView,
  playerId: PlayerId,
): GameActionUnavailableReasonCode | null {
  if (view.phase !== "support") {
    return "INVALID_PHASE";
  }
  return view.self.playerId === playerId && !view.self.supportFinished
    ? null
    : "SUPPORT_ALREADY_FINISHED";
}

function getOpenSlots(
  groups: readonly VisibleAttackGroup[],
): AttackGroupSlotIndex[] {
  const occupied = new Set(groups.map((group) => group.slotIndex));
  return ATTACK_GROUP_SLOT_INDICES.filter((slot) => !occupied.has(slot));
}

function toAvailability(
  reason: GameActionUnavailableReasonCode | null,
): AvailableAction {
  return reason === null ? { available: true } : unavailable(reason);
}

function unavailable(
  unavailableReason: GameActionUnavailableReasonCode,
): AvailableAction {
  return { available: false, unavailableReason };
}

function unavailablePlacement(
  unavailableReason: GameActionUnavailableReasonCode,
): AvailableAttackPlacement {
  return { ...unavailable(unavailableReason), slotIndices: [] };
}

function unavailableChain(
  unavailableReason: GameActionUnavailableReasonCode,
): AvailableAttackChain {
  return { ...unavailable(unavailableReason), targetGroupIds: [] };
}

function unavailableSupport(
  unavailableReason: GameActionUnavailableReasonCode,
): AvailableSupportPlay {
  return { ...unavailable(unavailableReason), effectSelections: [] };
}
