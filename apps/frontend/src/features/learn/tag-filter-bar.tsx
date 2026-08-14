export function TagFilterBar({
  allTags,
  selectedTags,
  onToggleTag,
  onClearTags,
}: {
  allTags: readonly string[];
  selectedTags: readonly string[];
  onToggleTag: (tag: string) => void;
  onClearTags?: () => void;
}) {
  if (allTags.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedTags);
  const hasSelected = selectedTags.length > 0;

  return (
    <div
      aria-label="タグで絞り込み"
      className="flex flex-col gap-2 rounded-md border border-[#2a3d4b] bg-[#081722]/60 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-[#8da5b5]">
          TAGS (
          {selectedTags.length > 0
            ? `${selectedTags.length}件選択中`
            : "すべて"}
          )
        </span>
        {hasSelected && onClearTags !== undefined ? (
          <button
            className="text-xs font-medium text-[#bcdcf0] underline underline-offset-4 hover:text-[#e8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
            onClick={onClearTags}
            type="button"
          >
            タグ選択を解除
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {allTags.map((tag) => {
          const isSelected = selectedSet.has(tag);
          return (
            <button
              aria-pressed={isSelected}
              className={`rounded border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced] ${
                isSelected
                  ? "border-[#c49b49] bg-[linear-gradient(180deg,rgba(110,81,33,.95),rgba(52,38,18,.98))] text-[#fff4d6] shadow-[0_0_8px_rgba(196,155,73,0.3)]"
                  : "border-[#2d495d] bg-[#07131c]/70 text-[#9fb5c3] hover:border-[#537e9d] hover:bg-[#0e2231] hover:text-[#d3e5f2]"
              }`}
              key={tag}
              onClick={() => onToggleTag(tag)}
              type="button"
            >
              #{tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
