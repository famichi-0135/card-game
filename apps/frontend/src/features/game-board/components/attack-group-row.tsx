import {
  ATTACK_GROUP_SLOT_INDICES,
  type AttackGroupSlotIndex,
  type AvailableGameActions,
  type PublicCardCatalog,
  type VisibleAttackGroup,
} from "@disastar/game-engine";
import { AttackGroupSlot } from "./attack-group-slot.tsx";

export function AttackGroupRow({
  catalog,
  groups,
  label,
  perspective,
  availableActions,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  groups: readonly VisibleAttackGroup[];
  label: string;
  perspective: "self" | "opponent";
  availableActions?: AvailableGameActions;
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  return (
    <section
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2"
      aria-label={label}
    >
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-slate-500">{groups.length} / 5</span>
      </div>
      <div className="grid min-h-0 grid-cols-5 gap-3">
        {ATTACK_GROUP_SLOT_INDICES.map((slotIndex) => {
          const group = groups.find(
            (candidate) => candidate.slotIndex === slotIndex,
          );
          const canPlace =
            perspective === "self" &&
            hasPlacementCandidate(availableActions, slotIndex) &&
            group === undefined;
          return (
            <AttackGroupSlot
              key={slotIndex}
              catalog={catalog}
              group={group}
              slotIndex={slotIndex}
              canPlace={canPlace}
              isSelf={perspective === "self"}
              onOpenGroup={onOpenGroup}
            />
          );
        })}
      </div>
    </section>
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
