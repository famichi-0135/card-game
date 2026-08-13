import { useEffect } from "react";
import {
  TACTICAL_MODAL_OVERLAY_CLASS,
  TACTICAL_MODAL_PRIMARY_BUTTON_CLASS,
  TACTICAL_MODAL_SECONDARY_BUTTON_CLASS,
  TACTICAL_MODAL_SURFACE_CLASS,
} from "@/components/ui/tactical-overlay-theme.ts";
import { UI_LAYER_CLASS } from "@/components/ui/ui-layers.ts";
import { cn } from "@/lib/utils";

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
      className={cn(
        "fixed inset-0 flex items-center justify-center p-6",
        UI_LAYER_CLASS.modal,
        TACTICAL_MODAL_OVERLAY_CLASS,
      )}
      data-ui-layer="modal"
      onMouseDown={onCancel}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="phase-end-dialog-title"
        className={cn("w-full max-w-md p-5", TACTICAL_MODAL_SURFACE_CLASS)}
        data-modal-theme="tactical-dark"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 className="text-lg font-semibold" id="phase-end-dialog-title">
          {actionLabel}を確定しますか？
        </h2>
        <p className="mt-2 text-sm text-[#9fb0b8]">
          確定後は、このフェーズでカードを操作できなくなります。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className={
              TACTICAL_MODAL_SECONDARY_BUTTON_CLASS + " px-3 py-2 text-sm"
            }
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className={
              TACTICAL_MODAL_PRIMARY_BUTTON_CLASS + " px-3 py-2 text-sm"
            }
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
