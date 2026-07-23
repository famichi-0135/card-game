import type { DragEndEvent } from "@dnd-kit/react";
import {
  ATTACK_GROUP_SLOT_INDICES,
  getAvailableGameActions,
  getAdditionalAttackGroupManaRequired,
  type AttackGroupSlotIndex,
  type AvailableSupportEffectSelection,
  type EffectInput,
  type GameCommand,
  type GamePhase,
  type PlayerGameView,
  type PublicCardCatalog,
  type VisibleAttackGroup,
  type VisibleCardInstance,
} from "@disastar/game-engine";
import { useMemo, useState } from "react";

type LocalBoardState = {
  attackGroups: VisibleAttackGroup[];
  discardPile: VisibleCardInstance[];
  hand: VisibleCardInstance[];
  mana: PlayerGameView["self"]["mana"];
  phase: GamePhase;
  phaseDeadlineAt: number | null;
  phaseSequence: number;
  stateVersion: number;
  supportZone: VisibleCardInstance[];
  supportFinished: boolean;
};

export type PendingSupportPlay = {
  card: VisibleCardInstance;
  effectSelections: readonly AvailableSupportEffectSelection[];
};

export function useGameBoardActions({
  catalog,
  onCommand,
  preview,
  view,
}: {
  catalog: PublicCardCatalog;
  onCommand?: (command: GameCommand) => void;
  preview: boolean;
  view: PlayerGameView;
}) {
  const [boardState, setBoardState] = useState<LocalBoardState>(() => ({
    attackGroups: [...view.self.attackGroups],
    discardPile: [...view.self.discardPile],
    hand: [...view.self.hand],
    mana: view.self.mana,
    phase: view.phase,
    phaseDeadlineAt: view.phaseDeadlineAt,
    phaseSequence: view.phaseSequence,
    stateVersion: view.stateVersion,
    supportZone: [...view.self.supportZone],
    supportFinished: view.self.supportFinished,
  }));
  const [pendingSupportPlay, setPendingSupportPlay] =
    useState<PendingSupportPlay | null>(null);
  const currentView = useMemo(
    () =>
      preview
        ? {
            ...view,
            phase: boardState.phase,
            phaseDeadlineAt: boardState.phaseDeadlineAt,
            phaseSequence: boardState.phaseSequence,
            stateVersion: boardState.stateVersion,
            self: {
              ...view.self,
              attackGroups: boardState.attackGroups,
              discardPile: boardState.discardPile,
              hand: boardState.hand,
              handCount: boardState.hand.length,
              mana: boardState.mana,
              supportZone: boardState.supportZone,
              supportFinished: boardState.supportFinished,
            },
          }
        : view,
    [boardState, preview, view],
  );
  const availableActions = useMemo(
    () =>
      getAvailableGameActions({ view: currentView, catalog, now: Date.now() }),
    [catalog, currentView],
  );

  const handleDragEnd = ({ canceled, operation }: DragEndEvent) => {
    const cardInstanceId = operation.source?.data.cardInstanceId as
      | string
      | undefined;
    const targetKind = operation.target?.data.kind as string | undefined;
    const slotIndex = operation.target?.data.slotIndex as number | undefined;
    const targetGroupId = operation.target?.data.groupId as string | undefined;
    const targetSide = operation.target?.data.side as string | undefined;

    if (canceled || cardInstanceId === undefined || targetSide !== "self") {
      return;
    }
    if (!preview && onCommand === undefined) {
      return;
    }

    const card = currentView.self.hand.find(
      (candidate) => candidate.instanceId === cardInstanceId,
    );
    if (card === undefined) {
      return;
    }
    const definition = catalog.definitions[card.definitionId];
    if (definition === undefined) {
      return;
    }

    const actions = availableActions.handCards[cardInstanceId];
    if (actions === undefined) {
      return;
    }

    if (targetKind === "support-zone") {
      if (!actions.playSupport.available) {
        return;
      }

      setPendingSupportPlay({
        card,
        effectSelections: actions.playSupport.effectSelections,
      });
      return;
    }

    if (targetKind === "discard-zone") {
      if (!actions.discard.available) {
        return;
      }

      const command = createDiscardHandCommand(currentView, cardInstanceId);
      if (onCommand !== undefined) {
        onCommand(command);
        return;
      }
      if (!preview) {
        return;
      }

      setBoardState((current) => ({
        ...current,
        discardPile: [...current.discardPile, card],
        hand: current.hand.filter(
          (candidate) => candidate.instanceId !== cardInstanceId,
        ),
        stateVersion: current.stateVersion + 1,
      }));
      return;
    }

    if (
      definition.cardType !== "attack" ||
      slotIndex === undefined ||
      !isAttackGroupSlotIndex(slotIndex)
    ) {
      return;
    }

    if (targetGroupId !== undefined) {
      if (
        !actions.chainAttack.available ||
        !actions.chainAttack.targetGroupIds.includes(targetGroupId)
      ) {
        return;
      }

      const command = createChainAttackCommand(
        currentView,
        cardInstanceId,
        targetGroupId,
      );
      if (onCommand !== undefined) {
        onCommand(command);
        return;
      }
      if (!preview) {
        return;
      }

      setBoardState((current) =>
        chainPreviewCard(
          current,
          card,
          definition.cost ?? 0,
          definition.basePower ?? 0,
          targetGroupId,
        ),
      );
      return;
    }

    if (
      !actions.placeAttack.available ||
      !actions.placeAttack.slotIndices.includes(slotIndex)
    ) {
      return;
    }

    const command = createPlaceAttackCommand(
      currentView,
      cardInstanceId,
      slotIndex,
    );
    if (onCommand !== undefined) {
      onCommand(command);
      return;
    }
    if (!preview) {
      return;
    }

    setBoardState((current) => {
      if (current.attackGroups.some((group) => group.slotIndex === slotIndex)) {
        return current;
      }

      return {
        ...current,
        hand: current.hand.filter(
          (candidate) => candidate.instanceId !== cardInstanceId,
        ),
        attackGroups: [
          ...current.attackGroups,
          {
            groupId: `preview-group-${slotIndex}-${card.instanceId}`,
            ownerId: view.self.playerId,
            slotIndex,
            attribute: definition.attribute,
            createdRound: view.round,
            cards: [card],
            requiredMana: definition.cost ?? 0,
            currentPower: definition.basePower ?? 0,
          },
        ],
        mana: reserveMana(
          current.mana,
          definition.attribute,
          definition.cost ?? 0,
        ),
        stateVersion: current.stateVersion + 1,
      };
    });
  };

  const finishPhase = () => {
    const command = createFinishPhaseCommand(currentView);
    if (command === null) {
      return;
    }

    const finishAction =
      command.type === "FINISH_SUPPORT"
        ? availableActions.finishSupport
        : availableActions.finishPlacement;
    if (!finishAction.available) {
      return;
    }

    if (onCommand !== undefined) {
      onCommand(command);
      return;
    }
    if (!preview) {
      return;
    }

    setBoardState((current) => advancePreviewPhase(current));
  };

  const cancelSupportPlay = () => setPendingSupportPlay(null);

  const confirmSupportPlay = (effectInputs: EffectInput[]) => {
    const pending = pendingSupportPlay;
    if (pending === null) {
      return;
    }

    const actions = availableActions.handCards[pending.card.instanceId];
    if (actions === undefined || !actions.playSupport.available) {
      return;
    }

    const definition = catalog.definitions[pending.card.definitionId];
    if (definition === undefined || definition.cardType !== "support") {
      return;
    }

    const command = createPlaySupportCommand(
      currentView,
      pending.card.instanceId,
      effectInputs,
    );
    setPendingSupportPlay(null);
    if (onCommand !== undefined) {
      onCommand(command);
      return;
    }
    if (!preview) {
      return;
    }

    setBoardState((current) => ({
      ...current,
      hand: current.hand.filter(
        (candidate) => candidate.instanceId !== pending.card.instanceId,
      ),
      mana: reserveMana(
        current.mana,
        definition.attribute,
        definition.cost ?? 0,
      ),
      stateVersion: current.stateVersion + 1,
      supportZone: [...current.supportZone, pending.card],
    }));
  };

  return {
    availableActions,
    cancelSupportPlay,
    confirmSupportPlay,
    currentView,
    finishPhase,
    handleDragEnd,
    pendingSupportPlay,
  };
}

function isAttackGroupSlotIndex(value: number): value is AttackGroupSlotIndex {
  return ATTACK_GROUP_SLOT_INDICES.includes(value as AttackGroupSlotIndex);
}

function createPlaceAttackCommand(
  view: PlayerGameView,
  cardInstanceId: string,
  slotIndex: AttackGroupSlotIndex,
): GameCommand {
  return {
    ...createBaseCommand(view),
    type: "PLACE_ATTACK_CARD",
    cardInstanceId,
    slotIndex,
    effectInputs: [],
  };
}

function createChainAttackCommand(
  view: PlayerGameView,
  cardInstanceId: string,
  targetGroupId: string,
): GameCommand {
  return {
    ...createBaseCommand(view),
    type: "CHAIN_ATTACK_CARD",
    cardInstanceId,
    targetGroupId,
    effectInputs: [],
  };
}

function createDiscardHandCommand(
  view: PlayerGameView,
  cardInstanceId: string,
): GameCommand {
  return {
    ...createBaseCommand(view),
    type: "DISCARD_HAND_CARD",
    cardInstanceId,
  };
}

function createPlaySupportCommand(
  view: PlayerGameView,
  cardInstanceId: string,
  effectInputs: EffectInput[],
): GameCommand {
  return {
    ...createBaseCommand(view),
    type: "PLAY_SUPPORT_CARD",
    cardInstanceId,
    effectInputs,
  };
}

function createFinishPhaseCommand(view: PlayerGameView): GameCommand | null {
  const baseCommand = createBaseCommand(view);

  if (
    view.phase === "firstPlayerPlacement" ||
    view.phase === "secondPlayerPlacement"
  ) {
    return { ...baseCommand, type: "FINISH_PLACEMENT" };
  }
  if (view.phase === "support") {
    return { ...baseCommand, type: "FINISH_SUPPORT" };
  }
  return null;
}

function createBaseCommand(view: PlayerGameView) {
  return {
    commandId: `preview-${crypto.randomUUID()}`,
    gameId: view.gameId,
    playerId: view.viewerPlayerId,
    phaseSequence: view.phaseSequence,
    clientStateVersion: view.stateVersion,
    issuedAt: Date.now(),
  };
}

function chainPreviewCard(
  current: LocalBoardState,
  card: VisibleCardInstance,
  cardCost: number,
  cardPower: number,
  targetGroupId: string,
): LocalBoardState {
  const targetGroup = current.attackGroups.find(
    (group) => group.groupId === targetGroupId,
  );
  if (targetGroup === undefined) {
    return current;
  }

  const additionalMana = getAdditionalAttackGroupManaRequired(
    targetGroup.requiredMana,
    cardCost,
  );
  return {
    ...current,
    hand: current.hand.filter(
      (candidate) => candidate.instanceId !== card.instanceId,
    ),
    attackGroups: current.attackGroups.map((group) =>
      group.groupId === targetGroupId
        ? {
            ...group,
            cards: [...group.cards, card],
            currentPower: group.currentPower + cardPower,
            requiredMana: group.requiredMana + additionalMana,
          }
        : group,
    ),
    mana: reserveMana(current.mana, targetGroup.attribute, additionalMana),
    stateVersion: current.stateVersion + 1,
  };
}

function reserveMana(
  mana: PlayerGameView["self"]["mana"],
  attribute: VisibleAttackGroup["attribute"],
  amount: number,
): PlayerGameView["self"]["mana"] {
  const current = mana[attribute];
  return {
    ...mana,
    [attribute]: {
      ...current,
      available: current.available - amount,
      reserved: current.reserved + amount,
    },
  };
}

function advancePreviewPhase(current: LocalBoardState): LocalBoardState {
  const nextPhase =
    current.phase === "firstPlayerPlacement"
      ? "secondPlayerPlacement"
      : current.phase === "secondPlayerPlacement"
        ? "support"
        : current.phase;
  const isSupportFinish = current.phase === "support";

  return {
    ...current,
    phase: nextPhase,
    phaseDeadlineAt: Date.now() + 78_000,
    phaseSequence: isSupportFinish
      ? current.phaseSequence
      : current.phaseSequence + 1,
    stateVersion: current.stateVersion + 1,
    supportFinished: current.supportFinished || isSupportFinish,
  };
}
