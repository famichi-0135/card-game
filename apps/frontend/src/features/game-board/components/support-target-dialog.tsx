import type {
  AvailableSupportEffectSelection,
  EffectInput,
  EffectTarget,
  PlayerGameView,
} from "@disastar/game-engine";
import { useEffect, useMemo, useState } from "react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-6"
      onMouseDown={onCancel}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="support-target-dialog-title"
        className="max-h-[70dvh] w-full max-w-2xl overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="border-b border-slate-200 p-4">
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
                  <span className="text-xs text-slate-500">
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
                        className={`rounded-md border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                          selectedCandidate
                            ? "border-slate-900 bg-slate-100"
                            : "border-slate-300 hover:bg-slate-50"
                        } disabled:cursor-not-allowed disabled:text-slate-400`}
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
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
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
