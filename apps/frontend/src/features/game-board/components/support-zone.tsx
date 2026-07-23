import { useDroppable } from "@dnd-kit/react";

export function SupportZone({
  canPlaySupport,
  count,
  onOpen,
}: {
  canPlaySupport: boolean;
  count: number;
  onOpen: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "support-zone",
    type: "support-zone",
    accept: "hand-card",
    disabled: !canPlaySupport,
    data: { kind: "support-zone", side: "self" },
  });

  return (
    <div
      ref={ref}
      className={`relative rounded-md ${
        isDropTarget ? "outline-2 outline-offset-2 outline-slate-900" : ""
      }`}
    >
      <button
        className={`w-full rounded-md border p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          canPlaySupport ? "border-dashed border-slate-500" : "border-slate-300"
        }`}
        onClick={onOpen}
        type="button"
      >
        <span className="block text-xs text-slate-500">サポート</span>
        <strong className="text-lg">{count}</strong>
        <span className="ml-1 text-xs">枚</span>
        {canPlaySupport ? (
          <span className="mt-1 block text-xs text-slate-500">ここへ使用</span>
        ) : null}
      </button>
    </div>
  );
}
