export type GameConnectionState =
  | "connected"
  | "offline"
  | "reconnecting"
  | "resynchronizing"
  | "unrecoverable";

export function ConnectionStatus({
  onResynchronize,
  state,
}: {
  onResynchronize?: () => void;
  state: GameConnectionState;
}) {
  const label = getConnectionLabel(state);
  const canRetry = state === "reconnecting" && onResynchronize !== undefined;

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-slate-500"
      role="status"
    >
      <span>{label}</span>
      {canRetry ? (
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={onResynchronize}
          type="button"
        >
          再同期
        </button>
      ) : null}
    </div>
  );
}

function getConnectionLabel(state: GameConnectionState): string {
  switch (state) {
    case "connected":
      return "接続済み";
    case "offline":
      return "オフライン";
    case "reconnecting":
      return "再接続中";
    case "resynchronizing":
      return "再同期中";
    case "unrecoverable":
      return "復旧できません";
  }
}
