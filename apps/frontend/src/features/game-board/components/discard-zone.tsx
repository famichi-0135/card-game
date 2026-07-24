import { useDroppable } from "@dnd-kit/react";

export function DiscardZone({
  canDiscard,
  count,
  onOpen,
}: {
  canDiscard: boolean;
  count: number;
  onOpen: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "discard-zone",
    type: "discard-zone",
    accept: "hand-card",
    disabled: !canDiscard,
    data: { kind: "discard-zone", side: "self" },
  });

  return (
    <div
      ref={ref}
      className={`relative h-full rounded-md ${
        isDropTarget ? "outline-2 outline-offset-2 outline-slate-900" : ""
      }`}
    >
      <button
        className={`h-full w-full rounded-md border p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          canDiscard ? "border-dashed border-slate-500" : "border-slate-300"
        }`}
        onClick={onOpen}
        type="button"
      >
        <span className="block text-xs text-slate-500">捨て札</span>
        <strong className="text-lg">{count}</strong>
        <span className="ml-1 text-xs">枚</span>
        {canDiscard ? (
          <span className="mt-1 block text-xs text-slate-500">ここへ破棄</span>
        ) : null}
      </button>
    </div>
  );
}
