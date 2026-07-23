export function OpponentZone({
  deckCount,
  discardCount,
  gameId,
  handCount,
  stateVersion,
  onOpenDiscard,
}: {
  deckCount: number;
  discardCount: number;
  gameId: string;
  handCount: number;
  stateVersion: number;
  onOpenDiscard: () => void;
}) {
  return (
    <header className="grid grid-cols-[210px_minmax(0,1fr)_210px] items-start gap-3">
      <div className="rounded-b-md border border-slate-300 bg-white px-3 py-2 text-sm">
        <p className="text-slate-500">相手の山札</p>
        <strong>{deckCount} 枚</strong>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-center">
          <p className="text-lg font-semibold tracking-wide">DISASTAR</p>
          <p className="text-xs text-slate-500">
            対戦 ID: {gameId} / 状態 v{stateVersion}
          </p>
        </div>
        <div
          className="flex justify-center gap-2"
          aria-label={`相手の手札 ${handCount} 枚`}
        >
          {Array.from({ length: handCount }, (_, index) => (
            <span
              className="h-10 w-7 rounded-b border border-slate-300 bg-white"
              key={index}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <button
        className="rounded-b-md border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        onClick={onOpenDiscard}
        type="button"
      >
        <span className="block text-slate-500">相手の捨て札</span>
        <strong>{discardCount} 枚</strong>
      </button>
    </header>
  );
}
