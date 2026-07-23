import type { SavedDeckView } from "@disastar/contracts/deck";

const factionLabels = {
  disaster: "災害側",
  countermeasure: "対策側",
} as const;

export function DeckSelector({
  decks,
  selectedDeckId,
  onSelect,
  disabled = false,
}: {
  decks: readonly SavedDeckView[];
  selectedDeckId: string | null;
  onSelect: (deckId: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="grid gap-2" aria-label="使用するデッキ">
      {decks.map((deck) => {
        const isSelected = deck.id === selectedDeckId;
        return (
          <li key={deck.id}>
            <button
              aria-pressed={isSelected}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                isSelected
                  ? "border-slate-800 bg-slate-100"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`}
              disabled={disabled}
              onClick={() => onSelect(deck.id)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-950">
                  {deck.name}
                </span>
                <span className="mt-1 block text-xs text-slate-600">
                  {factionLabels[deck.faction]} /{" "}
                  {deck.cardDefinitionIds.length}枚
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`h-3 w-3 rounded-full border ${
                  isSelected
                    ? "border-slate-900 bg-slate-900"
                    : "border-slate-400 bg-white"
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
