import { useEffect } from "react";

export function PhaseEndDialog({
  actionLabel,
  onCancel,
  onConfirm,
}: {
  actionLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-6"
      onMouseDown={onCancel}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="phase-end-dialog-title"
        className="w-full max-w-md rounded-md border border-slate-300 bg-white p-5 shadow-sm"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 className="text-lg font-semibold" id="phase-end-dialog-title">
          {actionLabel}を確定しますか？
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          確定後は、このフェーズでカードを操作できなくなります。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onConfirm}
            type="button"
          >
            確定する
          </button>
        </div>
      </section>
    </div>
  );
}
