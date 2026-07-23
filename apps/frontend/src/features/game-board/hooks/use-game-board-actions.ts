import type { DragEndEvent } from "@dnd-kit/react";
import {
  ATTACK_GROUP_SLOT_INDICES,
  getAvailableGameActions,
  type AttackGroupSlotIndex,
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
  hand: VisibleCardInstance[];
  phase: GamePhase;
  phaseDeadlineAt: number | null;
  phaseSequence: number;
  stateVersion: number;
  supportFinished: boolean;
};

export function useGameBoardActions({
  catalog,
  onCommand,
  view,
}: {
  catalog: PublicCardCatalog;
  onCommand?: (command: GameCommand) => void;
  view: PlayerGameView;
}) {
  const [boardState, setBoardState] = useState<LocalBoardState>(() => ({
    attackGroups: [...view.self.attackGroups],
    hand: [...view.self.hand],
    phase: view.phase,
    phaseDeadlineAt: view.phaseDeadlineAt,
    phaseSequence: view.phaseSequence,
    stateVersion: view.stateVersion,
    supportFinished: view.self.supportFinished,
  }));
  const currentView = useMemo(
    () => ({
      ...view,
      phase: boardState.phase,
      phaseDeadlineAt: boardState.phaseDeadlineAt,
      phaseSequence: boardState.phaseSequence,
      stateVersion: boardState.stateVersion,
      self: {
        ...view.self,
        attackGroups: boardState.attackGroups,
        hand: boardState.hand,
        handCount: boardState.hand.length,
        supportFinished: boardState.supportFinished,
      },
    }),
    [boardState, view],
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
    const slotIndex = operation.target?.data.slotIndex as number | undefined;
    const targetSide = operation.target?.data.side as string | undefined;

    if (
      canceled ||
      cardInstanceId === undefined ||
      slotIndex === undefined ||
      targetSide !== "self" ||
      !isAttackGroupSlotIndex(slotIndex)
    ) {
      return;
    }

    const actions = availableActions.handCards[cardInstanceId];
    if (
      actions === undefined ||
      !actions.placeAttack.available ||
      !actions.placeAttack.slotIndices.includes(slotIndex)
    ) {
      return;
    }

    setBoardState((current) => {
      if (current.attackGroups.some((group) => group.slotIndex === slotIndex)) {
        return current;
      }

      const card = current.hand.find(
        (candidate) => candidate.instanceId === cardInstanceId,
      );
      if (card === undefined) {
        return current;
      }

      const definition = catalog.definitions[card.definitionId];
      if (definition === undefined || definition.cardType !== "attack") {
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

    setBoardState((current) => advancePreviewPhase(current));
  };

  return { availableActions, currentView, finishPhase, handleDragEnd };
}

function isAttackGroupSlotIndex(value: number): value is AttackGroupSlotIndex {
  return ATTACK_GROUP_SLOT_INDICES.includes(value as AttackGroupSlotIndex);
}

function createFinishPhaseCommand(view: PlayerGameView): GameCommand | null {
  const baseCommand = {
    commandId: `preview-${crypto.randomUUID()}`,
    gameId: view.gameId,
    playerId: view.viewerPlayerId,
    phaseSequence: view.phaseSequence,
    clientStateVersion: view.stateVersion,
    issuedAt: Date.now(),
  };

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
