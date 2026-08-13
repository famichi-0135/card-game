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
  selectedCardTarget,
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
  selectedCardTarget?: "chain" | "place";
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

  const hasSelectedCardOnThisSlot =
    hasSelectedCard === true && group === undefined && canPlace;

  const content =
    group === undefined ? (
      <div className="flex h-full flex-col items-center justify-center gap-[6px] text-center">
        <span
          aria-hidden="true"
          className={cn(
            "font-mono text-[30px] leading-none font-light",
            canPlace ? "text-[#7fa3b5]" : "text-[#4a5b64]",
            hasSelectedCardOnThisSlot
              ? "shadow-[0_0_8px_rgba(127,163,181,.4)]"
              : "",
          )}
        >
          +
        </span>
        <span className="text-[9px] tracking-[.14em] text-[#78909a]">
          {canPlace ? "配置可能" : "EMPTY SLOT"}
        </span>
      </div>
    ) : (
      <div className="relative flex h-full min-h-0 flex-col gap-[4px] pt-[16px] text-left">
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <GroupCard
            card={group.cards.at(-1)}
            catalog={catalog}
            group={group}
          />
        </div>
        <span className="shrink-0 text-center text-[9px] tracking-[.06em] text-[#b8c6c9]">
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
        "relative min-h-0 overflow-hidden border bg-[linear-gradient(180deg,rgba(8,15,20,.94),rgba(3,7,10,.97))] p-[5px] shadow-[inset_0_0_22px_rgba(0,0,0,.78)] [clip-path:polygon(5px_0,calc(100%_-_5px)_0,100%_5px,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,5px_100%,0_calc(100%_-_5px),0_5px)] before:pointer-events-none before:absolute before:inset-[3px] before:border before:border-white/[.05]",
        isSelf ? "border-[#2c6e90]" : "border-[#7b3937]",
        selectedCardTarget !== undefined
          ? "border-[#e6c46d] ring-1 ring-[#e6c46d]/75 shadow-[inset_0_0_22px_rgba(0,0,0,.78),0_0_14px_rgba(230,196,109,.22)]"
          : isDropTarget && (canPlace || canChain)
            ? "ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]"
            : canPlace || canChain
              ? "border-dashed"
              : "opacity-90",
      )}
      data-selected-card-target={selectedCardTarget}
    >
      <span
        className={cn(
          "absolute z-20 left-[6px] top-[5px] border bg-black/75 px-[4px] py-px font-mono text-[8px] tabular-nums shadow-[0_1px_2px_rgba(0,0,0,.8)]",
          isSelf
            ? "border-[#2c6e90]/70 text-[#9fc6dd]"
            : "border-[#7b3937]/70 text-[#d59a95]",
        )}
      >
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
