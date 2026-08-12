import { useDroppable } from "@dnd-kit/react";
import type {
  AttackGroupSlotIndex,
  PublicCardCatalog,
  VisibleAttackGroup,
  VisibleCardInstance,
} from "@disastar/game-engine";
import { cardTypeMark } from "./card-presentation.ts";
import type { GameBoardCardTarget } from "../hooks/use-game-board-actions.ts";
import { BoardCard } from "./board-card.tsx";
import { cn } from "@/lib/utils";

export function AttackGroupSlot({
  catalog,
  group,
  slotIndex,
  canChain,
  canPlace,
  hasSelectedCard,
  isSelf,
  onSelectTarget,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  group: VisibleAttackGroup | undefined;
  slotIndex: AttackGroupSlotIndex;
  canChain: boolean;
  canPlace: boolean;
  hasSelectedCard?: boolean;
  isSelf: boolean;
  onSelectTarget?: (target: GameBoardCardTarget) => boolean;
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `attack-slot-${isSelf ? "self" : "opponent"}-${slotIndex}`,
    type: "attack-slot",
    disabled: !isSelf,
    accept: "hand-card",
    data: {
      slotIndex,
      groupId: group?.groupId,
      side: isSelf ? "self" : "opponent",
    },
  });

  const content =
    group === undefined ? (
      <div className="flex h-full flex-col items-center justify-center gap-[7px] text-center text-[10px] tracking-[.08em] text-[#78909a]">
        <span className="grid size-[30px] place-items-center border border-dashed border-current/60 font-mono text-[13px] text-[#aac0c8]">
          {String(slotIndex + 1).padStart(2, "0")}
        </span>
        <span>{canPlace ? "配置可能" : "EMPTY SLOT"}</span>
      </div>
    ) : (
      <div className="relative flex h-full min-h-0 flex-col gap-[5px] pt-[17px] text-left">
        <div className="min-h-0 flex-1">
          <GroupCard
            card={group.cards.at(-1)}
            catalog={catalog}
            group={group}
          />
        </div>
        <span className="text-center text-[9px] tracking-[.06em] text-[#b8c6c9]">
          CHAIN {group.cards.length} / POWER {group.currentPower}
        </span>
      </div>
    );

  const target: GameBoardCardTarget = {
    kind: "attack-slot",
    groupId: group?.groupId,
    slotIndex,
  };
  const handleClick = () => {
    if (onSelectTarget?.(target)) {
      return;
    }
    if (group !== undefined) {
      onOpenGroup?.(group);
    }
  };
  const canSelectTarget = isSelf && onSelectTarget !== undefined;

  return (
    <div
      ref={ref}
      className={cn(
        "relative min-h-0 overflow-hidden border bg-[#071118]/90 p-[5px] shadow-[inset_0_0_20px_rgba(0,0,0,.72)] [clip-path:polygon(5px_0,calc(100%_-_5px)_0,100%_5px,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,5px_100%,0_calc(100%_-_5px),0_5px)]",
        isSelf ? "border-[#2c6e90]" : "border-[#7b3937]",
        isDropTarget && (canPlace || canChain)
          ? "ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]"
          : canPlace || canChain
            ? "border-dashed"
            : "opacity-90",
      )}
    >
      <span className="absolute z-20 left-[7px] top-[5px] border border-white/[.14] bg-black/75 px-[3px] py-px font-mono text-[8px] text-[#a7bcc5]">
        {String(slotIndex + 1).padStart(2, "0")}
      </span>
      {canChain ? (
        <span className="absolute z-20 right-[7px] top-[6px] text-[8px] tracking-[.08em] text-[#e5c675]">
          連鎖可
        </span>
      ) : null}
      {canSelectTarget || (group !== undefined && onOpenGroup !== undefined) ? (
        <button
          aria-label={
            "攻撃グループ枠 " +
            (slotIndex + 1) +
            "。" +
            (canSelectTarget
              ? hasSelectedCard === true
                ? "選択中のカードをここへ操作"
                : "カードを選択してから操作"
              : "詳細を開く")
          }
          className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={handleClick}
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

function GroupCard({
  card,
  catalog,
  group,
}: {
  card: VisibleCardInstance | undefined;
  catalog: PublicCardCatalog;
  group: VisibleAttackGroup;
}) {
  const definition =
    card === undefined ? undefined : catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <BoardCard
      definition={definition}
      power={group.currentPower}
      requiredMana={group.requiredMana}
      sequenceLabel={cardTypeMark(definition.cardType)}
      size="field"
      tone={group.slotIndex >= 0 ? "faction" : "self"}
    />
  );
}
