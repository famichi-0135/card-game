import type {
  PublicCardCatalog,
  VisibleCardInstance,
} from "@disastar/game-engine";
import { useEffect } from "react";
import {
  attributeLabels,
  cardTypeLabel,
  cardTypeMark,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-6"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="zone-dialog-title"
        className="max-h-[70dvh] w-full max-w-2xl overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold" id="zone-dialog-title">
              {state.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{state.description}</p>
          </div>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onClose}
            type="button"
          >
            閉じる
          </button>
        </header>
        <div className="max-h-[calc(70dvh-88px)] overflow-y-auto p-4">
          {state.cards.length === 0 ? (
            <p className="text-sm text-slate-500">カードはありません。</p>
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

  return (
    <article className="rounded-md border border-slate-300 p-3">
      <div className="flex items-center justify-between gap-3">
        <strong>{definition.name}</strong>
        <span className="text-lg" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {cardTypeLabel(definition.cardType)} /{" "}
        {attributeLabels[definition.attribute]}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {definition.rulesText}
      </p>
    </article>
  );
}
