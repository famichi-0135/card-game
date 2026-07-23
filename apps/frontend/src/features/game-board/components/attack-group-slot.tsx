import { useDroppable } from "@dnd-kit/react";
import type {
  AttackGroupSlotIndex,
  PublicCardCatalog,
  VisibleAttackGroup,
  VisibleCardInstance,
} from "@disastar/game-engine";
import { cardTypeMark } from "./card-presentation.ts";

export function AttackGroupSlot({
  catalog,
  group,
  slotIndex,
  canPlace,
  isSelf,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  group: VisibleAttackGroup | undefined;
  slotIndex: AttackGroupSlotIndex;
  canPlace: boolean;
  isSelf: boolean;
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `attack-slot-${slotIndex}`,
    type: "attack-slot",
    accept: "hand-card",
    disabled: !canPlace,
    data: { slotIndex, side: isSelf ? "self" : "opponent" },
  });

  const content =
    group === undefined ? (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        {canPlace ? "ここへ配置" : "空き枠"}
      </div>
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-2 pt-4 text-left">
        <div className="flex items-center justify-center">
          {group.cards.slice(-3).map((card, index) => (
            <CompactCard
              key={card.instanceId}
              card={card}
              catalog={catalog}
              stacked={index > 0}
            />
          ))}
        </div>
        <span className="text-center text-xs text-slate-600">
          {group.cards.length} 枚 / 力 {group.currentPower}
        </span>
      </div>
    );

  return (
    <div
      ref={ref}
      className={`relative min-h-0 rounded-md border p-2 ${
        isDropTarget
          ? "border-slate-900 bg-slate-100"
          : canPlace
            ? "border-dashed border-slate-500 bg-white"
            : "border-slate-300 bg-slate-50"
      }`}
    >
      <span className="absolute left-2 top-1 text-[10px] text-slate-400">
        {String(slotIndex + 1).padStart(2, "0")}
      </span>
      {group !== undefined && onOpenGroup !== undefined ? (
        <button
          className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={() => onOpenGroup(group)}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

function CompactCard({
  card,
  catalog,
  stacked,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  stacked: boolean;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <span
      className={`flex h-16 w-12 shrink-0 flex-col justify-between rounded border border-slate-300 bg-white p-1 text-[9px] ${
        stacked ? "-ml-4 translate-y-1" : ""
      }`}
    >
      <span>{cardTypeMark(definition.cardType)}</span>
      <strong className="line-clamp-2 leading-tight">{definition.name}</strong>
    </span>
  );
}
