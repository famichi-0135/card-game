import { useDroppable } from "@dnd-kit/react";
import { cn } from "@/lib/utils";
import { CardBack } from "./game-ui/index.ts";

export function SupportZone({
  canPlaySupport,
  count,
  hasSelectedCard = false,
  onSelectTarget,
  onOpen,
}: {
  canPlaySupport: boolean;
  count: number;
  hasSelectedCard?: boolean;
  onSelectTarget?: () => boolean;
  onOpen: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "support-zone",
    type: "support-zone",
    accept: "hand-card",
    data: { kind: "support-zone", side: "self" },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-full min-h-0 flex-col gap-[5px]",
        isDropTarget &&
          canPlaySupport &&
          "rounded-[4px] ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]",
      )}
    >
      <div className="flex items-baseline justify-between px-[2px]">
        <span className="text-[9px] font-medium tracking-[.14em] text-[#9cb8c2]">
          SUPPORT ZONE
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[#bde3f0]">
          {count}
          <span className="ml-[2px] text-[8px] text-[#a7c1c9]">枚</span>
        </span>
      </div>
      <button
        aria-label={
          hasSelectedCard ? "サポート。選択中のカードをここで使用" : "サポート"
        }
        className={cn(
          "group relative min-h-0 flex-1 transition-[filter,transform] duration-150 hover:brightness-[1.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8acbf0] motion-reduce:transition-none",
          canPlaySupport && "brightness-[1.08]",
        )}
        onClick={() => {
          if (!onSelectTarget?.()) {
            onOpen();
          }
        }}
        type="button"
      >
        <CardBack className="size-full" />
        {canPlaySupport ? (
          <span className="absolute inset-x-[6px] bottom-[6px] z-10 border border-[#40718a]/70 bg-black/75 py-[2px] text-center text-[8px] tracking-[.08em] text-[#a8d4e8]">
            ここへ使用
          </span>
        ) : null}
      </button>
    </div>
  );
}
