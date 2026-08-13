import {
  ATTACK_GROUP_SLOT_INDICES,
  type AttackGroupSlotIndex,
  type AvailableGameActions,
  type PublicCardCatalog,
  type VisibleAttackGroup,
} from "@disastar/game-engine";
import { AttackGroupSlot } from "./attack-group-slot.tsx";
import type { GameBoardCardTarget } from "../hooks/use-game-board-actions.ts";

export function AttackGroupRow({
  catalog,
  groups,
  label,
  perspective,
  availableActions,
  hasSelectedCard = false,
  onSelectTarget,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  groups: readonly VisibleAttackGroup[];
  label: string;
  perspective: "self" | "opponent";
  availableActions?: AvailableGameActions;
  hasSelectedCard?: boolean;
  onSelectTarget?: (target: GameBoardCardTarget) => boolean;
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  return (
    <section
      className="relative z-10 grid min-h-0 grid-rows-[24px_minmax(0,1fr)] gap-[7px]"
      aria-label={label}
    >
      <div className="flex items-center gap-[8px] px-[2px]">
        <span
          aria-hidden="true"
          className={
            perspective === "opponent" ? "text-[#e24a4a]" : "text-[#4a8bff]"
          }
        >
          <svg className="size-[10px]" viewBox="0 0 10 10">
            <path
              d="M5 0L10 5L5 10L0 5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M5 2.8L7.2 5L5 7.2L2.8 5Z" fill="currentColor" />
          </svg>
        </span>
        <span
          className={
            "text-[10px] font-semibold tracking-[.18em] " +
            (perspective === "opponent"
              ? "text-[#e8a49e]"
              : "text-[#a8c8f0]")
          }
        >
          {perspective === "opponent" ? "相手" : "自分"} ATTACK GROUP
        </span>
        <svg
          aria-hidden="true"
          className="h-[8px] min-w-0 flex-1 text-[#54656e]"
          preserveAspectRatio="none"
          viewBox="0 0 100 8"
        >
          <path d="M0 4H100" stroke="#000" strokeWidth="3" />
          <path d="M0 4H100" stroke="currentColor" strokeOpacity=".55" />
        </svg>
        <span className="font-mono text-[9px] tracking-[.1em] text-[#91a6ae]">
          {groups.length} / 5
        </span>
      </div>
      <div className="grid min-h-0 grid-cols-5 gap-[9px]">
        {ATTACK_GROUP_SLOT_INDICES.map((slotIndex) => {
          const group = groups.find(
            (candidate) => candidate.slotIndex === slotIndex,
          );
          const canPlace =
            perspective === "self" &&
            hasPlacementCandidate(availableActions, slotIndex) &&
            group === undefined;
          const canChain =
            perspective === "self" &&
            group !== undefined &&
            hasChainCandidate(availableActions, group.groupId);
          return (
            <AttackGroupSlot
              key={slotIndex}
              catalog={catalog}
              group={group}
              slotIndex={slotIndex}
              canChain={canChain}
              canPlace={canPlace}
              hasSelectedCard={hasSelectedCard}
              isSelf={perspective === "self"}
              onSelectTarget={
                perspective === "self" ? onSelectTarget : undefined
              }
              onOpenGroup={onOpenGroup}
            />
          );
        })}
      </div>
    </section>
  );
}

function hasChainCandidate(
  availableActions: AvailableGameActions | undefined,
  groupId: string,
): boolean {
  if (availableActions === undefined) {
    return false;
  }
  return Object.values(availableActions.handCards).some(
    (actions) =>
      actions.chainAttack.available &&
      actions.chainAttack.targetGroupIds.includes(groupId),
  );
}

function hasPlacementCandidate(
  availableActions: AvailableGameActions | undefined,
  slotIndex: AttackGroupSlotIndex,
): boolean {
  if (availableActions === undefined) {
    return false;
  }
  return Object.values(availableActions.handCards).some(
    (actions) =>
      actions.placeAttack.available &&
      actions.placeAttack.slotIndices.includes(slotIndex),
  );
}
