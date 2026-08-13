import { useDroppable } from "@dnd-kit/react";
import { cn } from "@/lib/utils";
import { CardBack } from "./game-ui/index.ts";

export function DiscardZone({
  canDiscard,
  count,
  hasSelectedCard = false,
  onSelectTarget,
  onOpen,
}: {
  canDiscard: boolean;
  count: number;
  hasSelectedCard?: boolean;
  onSelectTarget?: () => boolean;
  onOpen: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "discard-zone",
    type: "discard-zone",
    accept: "hand-card",
    data: { kind: "discard-zone", side: "self" },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-full min-h-0 flex-col gap-[5px]",
        isDropTarget &&
          canDiscard &&
          "rounded-[4px] ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]",
      )}
    >
      <div className="flex items-baseline justify-between px-[2px]">
        <span className="text-[9px] font-medium tracking-[.14em] text-[#a99a7c]">
          捨て札
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[#f2d087]">
          {count}
          <span className="ml-[2px] text-[8px] text-[#b8ac93]">枚</span>
        </span>
      </div>
      <button
        aria-label={
          hasSelectedCard ? "捨て札。選択中のカードをここへ破棄" : "捨て札"
        }
        className={cn(
          "group relative min-h-0 flex-1 transition-[filter,transform] duration-150 hover:brightness-[1.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1cd7a] motion-reduce:transition-none",
          canDiscard && "brightness-[1.08]",
        )}
        onClick={() => {
          if (!onSelectTarget?.()) {
            onOpen();
          }
        }}
        type="button"
      >
        <CardBack className="size-full" />
        {canDiscard ? (
          <span className="absolute inset-x-[6px] bottom-[6px] z-10 border border-[#8a6f42]/70 bg-black/75 py-[2px] text-center text-[8px] tracking-[.08em] text-[#e3c88c]">
            ここへ破棄
          </span>
        ) : null}
      </button>
    </div>
  );
}
