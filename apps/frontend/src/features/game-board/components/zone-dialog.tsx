import type {
  PublicCardCatalog,
  VisibleCardInstance,
} from "@disastar/game-engine";
import { useEffect } from "react";
import {
  TACTICAL_MODAL_HEADER_CLASS,
  TACTICAL_MODAL_MUTED_TEXT_CLASS,
  TACTICAL_MODAL_OVERLAY_CLASS,
  TACTICAL_MODAL_SECONDARY_BUTTON_CLASS,
  TACTICAL_MODAL_SURFACE_CLASS,
} from "@/components/ui/tactical-overlay-theme.ts";
import { UI_LAYER_CLASS } from "@/components/ui/ui-layers.ts";
import { cn } from "@/lib/utils";
import {
  cardTypeLabel,
  cardTypeMark,
  getAttributeLabel,
  getChainableCardNames,
} from "./card-presentation.ts";

export type ZoneDialogState = {
  cards: readonly VisibleCardInstance[];
  description: string;
  title: string;
};

export function ZoneDialog({
  catalog,
  state,
  onClose,
}: {
  catalog: PublicCardCatalog;
  state: ZoneDialogState;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-6",
        UI_LAYER_CLASS.modal,
        TACTICAL_MODAL_OVERLAY_CLASS,
      )}
      data-ui-layer="modal"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="zone-dialog-title"
        className={cn(
          "max-h-[70dvh] w-full max-w-2xl overflow-hidden",
          TACTICAL_MODAL_SURFACE_CLASS,
        )}
        data-modal-theme="tactical-dark"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header
          className={cn(
            "flex items-start justify-between gap-4 border-b p-4",
            TACTICAL_MODAL_HEADER_CLASS,
          )}
        >
          <div>
            <h2 className="text-lg font-semibold" id="zone-dialog-title">
              {state.title}
            </h2>
            <p
              className={cn(
                "mt-1 text-sm",
                TACTICAL_MODAL_MUTED_TEXT_CLASS,
              )}
            >
              {state.description}
            </p>
          </div>
          <button
            className={TACTICAL_MODAL_SECONDARY_BUTTON_CLASS + " px-3 py-1 text-sm"}
            onClick={onClose}
            type="button"
          >
            閉じる
          </button>
        </header>
        <div className="max-h-[calc(70dvh-88px)] overflow-y-auto p-4">
          {state.cards.length === 0 ? (
            <p className={cn("text-sm", TACTICAL_MODAL_MUTED_TEXT_CLASS)}>
              カードはありません。
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3">
              {state.cards.map((card) => (
                <li key={card.instanceId}>
                  <ZoneCard card={card} catalog={catalog} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function ZoneCard({
  card,
  catalog,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }
  const chainableCardNames = getChainableCardNames(catalog, definition);

  return (
    <article className="border border-[#3a4a55]/70 bg-[#071017] p-3 shadow-[inset_0_0_12px_rgba(0,0,0,.6)]">
      <div className="flex items-center justify-between gap-3">
        <strong>{definition.name}</strong>
        <span className="text-lg text-[#e5c778]" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#8fa1ac]">
        {cardTypeLabel(definition.cardType)} /{" "}
        {getAttributeLabel(definition.faction, definition.attribute)}
      </p>
      <p className="mt-3 whitespace-pre-line text-xs leading-5 text-[#c1ced2]">
        {definition.rulesText}
      </p>
      {definition.cardType === "attack" ? (
        <p className="mt-3 border-t border-white/[.1] pt-3 text-xs leading-5 text-[#c1ced2]">
          <span className="text-[#8fa1ac]">連鎖可能なカード: </span>
          {chainableCardNames.length === 0
            ? "なし"
            : chainableCardNames.join("、")}
        </p>
      ) : null}
    </article>
  );
}
