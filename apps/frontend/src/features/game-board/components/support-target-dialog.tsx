import type {
  AvailableSupportEffectSelection,
  EffectInput,
  EffectTarget,
  PlayerGameView,
} from "@disastar/game-engine";
import { useEffect, useMemo, useState } from "react";
import {
  TACTICAL_MODAL_FOOTER_CLASS,
  TACTICAL_MODAL_HEADER_CLASS,
  TACTICAL_MODAL_OVERLAY_CLASS,
  TACTICAL_MODAL_PRIMARY_BUTTON_CLASS,
  TACTICAL_MODAL_SECONDARY_BUTTON_CLASS,
  TACTICAL_MODAL_SURFACE_CLASS,
} from "@/components/ui/tactical-overlay-theme.ts";
import { UI_LAYER_CLASS } from "@/components/ui/ui-layers.ts";
import { cn } from "@/lib/utils";

export function SupportTargetDialog({
  cardName,
  effectSelections,
  onCancel,
  onConfirm,
  view,
}: {
  cardName: string;
  effectSelections: readonly AvailableSupportEffectSelection[];
  onCancel: () => void;
  onConfirm: (effectInputs: EffectInput[]) => void;
  view: PlayerGameView;
}) {
  const [selectedTargets, setSelectedTargets] = useState<EffectTarget[][]>(() =>
    effectSelections.map(() => []),
  );
  const canConfirm = useMemo(
    () =>
      effectSelections.every((selection, index) => {
        const count = selectedTargets[index]?.length ?? 0;
        return count >= selection.minTargets && count <= selection.maxTargets;
      }),
    [effectSelections, selectedTargets],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const toggleTarget = (selectionIndex: number, target: EffectTarget) => {
    setSelectedTargets((current) => {
      const selected = current[selectionIndex] ?? [];
      const selection = effectSelections[selectionIndex];
      if (selection === undefined) {
        return current;
      }
      const alreadySelected = selected.some(
        (candidate) => targetKey(candidate) === targetKey(target),
      );
      const nextSelected = alreadySelected
        ? selected.filter(
            (candidate) => targetKey(candidate) !== targetKey(target),
          )
        : selected.length < selection.maxTargets
          ? [...selected, target]
          : selected;
      return current.map((targets, index) =>
        index === selectionIndex ? nextSelected : targets,
      );
    });
  };

  const confirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm(
      effectSelections.map((selection, index) => ({
        effectId: selection.effectId,
        targets: selectedTargets[index] ?? [],
      })),
    );
  };

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-6",
        UI_LAYER_CLASS.modal,
        TACTICAL_MODAL_OVERLAY_CLASS,
      )}
      data-ui-layer="modal"
      onMouseDown={onCancel}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="support-target-dialog-title"
        className={cn(
          "max-h-[70dvh] w-full max-w-2xl overflow-hidden",
          TACTICAL_MODAL_SURFACE_CLASS,
        )}
        data-modal-theme="tactical-dark"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={cn("border-b p-4", TACTICAL_MODAL_HEADER_CLASS)}>
          <h2
            className="text-lg font-semibold"
            id="support-target-dialog-title"
          >
            {cardName}の対象を選択
          </h2>
        </header>
        <div className="max-h-[calc(70dvh-144px)] space-y-5 overflow-y-auto p-4">
          {effectSelections.map((selection, selectionIndex) => {
            const selected = selectedTargets[selectionIndex] ?? [];
            return (
              <section key={`${selection.effectId}-${selection.stageIndex}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">対象 {selectionIndex + 1}</h3>
                  <span className="text-xs text-[#8fa1ac]">
                    {selected.length} / {selection.maxTargets} 選択
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selection.candidates.map((candidate) => {
                    const selectedCandidate = selected.some(
                      (target) => targetKey(target) === targetKey(candidate),
                    );
                    const isSelectionLimitReached =
                      !selectedCandidate &&
                      selected.length >= selection.maxTargets;
                    return (
                      <button
                        aria-pressed={selectedCandidate}
                        className={`border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e1b763] ${
                          selectedCandidate
                            ? "border-[#b08a4a] bg-[#171108] text-[#f2dfb2]"
                            : "border-[#3a4a55] bg-[#081119] text-[#c8d3d9] hover:border-[#52636e] hover:bg-[#0d1a23]"
                        } disabled:cursor-not-allowed disabled:text-[#5d6c75]`}
                        disabled={isSelectionLimitReached}
                        key={targetKey(candidate)}
                        onClick={() => toggleTarget(selectionIndex, candidate)}
                        type="button"
                      >
                        {targetLabel(candidate, view)}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <footer
          className={cn(
            "flex justify-end gap-2 border-t p-4",
            TACTICAL_MODAL_FOOTER_CLASS,
          )}
        >
          <button
            className={
              TACTICAL_MODAL_SECONDARY_BUTTON_CLASS + " px-3 py-2 text-sm"
            }
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className={
              TACTICAL_MODAL_PRIMARY_BUTTON_CLASS +
              " px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            }
            disabled={!canConfirm}
            onClick={confirm}
            type="button"
          >
            使用する
          </button>
        </footer>
      </section>
    </div>
  );
}

function targetKey(target: EffectTarget): string {
  switch (target.type) {
    case "attackCard":
    case "supportCard":
      return `${target.type}:${target.cardInstanceId}`;
    case "attackGroup":
      return `${target.type}:${target.groupId}`;
    case "player":
      return `${target.type}:${target.playerId}`;
    case "mana":
      return `${target.type}:${target.playerId}:${target.attribute}`;
  }
}

function targetLabel(target: EffectTarget, view: PlayerGameView): string {
  switch (target.type) {
    case "attackGroup": {
      const group = findAttackGroup(target.groupId, view);
      return group === undefined
        ? "攻撃グループ"
        : `${group.owner}の攻撃グループ ${group.slotIndex + 1}（力 ${group.currentPower}）`;
    }
    case "attackCard":
      return `攻撃カード ${target.cardInstanceId}`;
    case "supportCard":
      return `サポートカード ${target.cardInstanceId}`;
    case "player":
      return target.playerId === view.self.playerId ? "自分" : "相手";
    case "mana":
      return `${target.playerId === view.self.playerId ? "自分" : "相手"}の${target.attribute}`;
  }
}

function findAttackGroup(groupId: string, view: PlayerGameView) {
  const selfGroup = view.self.attackGroups.find(
    (group) => group.groupId === groupId,
  );
  if (selfGroup !== undefined) {
    return { ...selfGroup, owner: "自分" };
  }
  const opponentGroup = view.opponent.attackGroups.find(
    (group) => group.groupId === groupId,
  );
  return opponentGroup === undefined
    ? undefined
    : { ...opponentGroup, owner: "相手" };
}
