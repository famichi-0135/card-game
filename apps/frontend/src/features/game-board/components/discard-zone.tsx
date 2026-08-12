import { useDroppable } from "@dnd-kit/react";
import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "relative h-full",
        isDropTarget &&
          canDiscard &&
          "ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]",
      )}
    >
      <button
        aria-label={
          hasSelectedCard ? "捨て札。選択中のカードをここへ破棄" : "捨て札"
        }
        className={cn(
          "group h-full w-full border border-[#77603b] bg-[#100d09]/92 p-[12px] text-left text-[#e7dcc7] shadow-[inset_0_0_18px_rgba(0,0,0,.82)] transition-colors hover:border-[#b38d4d] hover:bg-[#17120b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1cd7a] [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)]",
          canDiscard && "border-dashed",
        )}
        onClick={() => {
          if (!onSelectTarget?.()) {
            onOpen();
          }
        }}
        type="button"
      >
        <Archive
          aria-hidden="true"
          className="mb-[9px] text-[#d3ad66]"
          size={18}
        />
        <span className="block text-[10px] tracking-[.1em] text-[#a99a7c]">
          捨て札
        </span>
        <strong className="font-mono text-[25px] text-[#f2d087]">
          {count}
        </strong>
        <span className="ml-1 text-[10px] text-[#b8ac93]">枚</span>
        {canDiscard ? (
          <span className="mt-1 block text-[9px] text-[#c3b493]">
            ここへ破棄
          </span>
        ) : null}
      </button>
    </div>
  );
}
