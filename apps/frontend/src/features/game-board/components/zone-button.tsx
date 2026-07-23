export function ZoneButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-md border border-slate-300 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      onClick={onClick}
      type="button"
    >
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="text-lg">{count}</strong>
      <span className="ml-1 text-xs">枚</span>
    </button>
  );
}
