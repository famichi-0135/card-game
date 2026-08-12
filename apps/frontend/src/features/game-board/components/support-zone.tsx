import { useDroppable } from "@dnd-kit/react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "relative h-full",
        isDropTarget &&
          canPlaySupport &&
          "ring-2 ring-[#e6c46d] ring-offset-2 ring-offset-[#071118]",
      )}
    >
      <button
        aria-label={
          hasSelectedCard ? "サポート。選択中のカードをここで使用" : "サポート"
        }
        className={cn(
          "group h-full w-full border border-[#40718a] bg-[#071117]/92 p-[12px] text-left text-[#d8e8ed] shadow-[inset_0_0_18px_rgba(0,0,0,.82)] transition-colors hover:border-[#6ca9c3] hover:bg-[#0c1920] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8acbf0] [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)]",
          canPlaySupport && "border-dashed",
        )}
        onClick={() => {
          if (!onSelectTarget?.()) {
            onOpen();
          }
        }}
        type="button"
      >
        <ShieldCheck
          aria-hidden="true"
          className="mb-[9px] text-[#70bddc]"
          size={18}
        />
        <span className="block text-[10px] tracking-[.1em] text-[#9cb8c2]">
          サポート
        </span>
        <strong className="font-mono text-[25px] text-[#bde3f0]">
          {count}
        </strong>
        <span className="ml-1 text-[10px] text-[#a7c1c9]">枚</span>
        {canPlaySupport ? (
          <span className="mt-1 block text-[9px] text-[#a7c1c9]">
            ここへ使用
          </span>
        ) : null}
      </button>
    </div>
  );
}
