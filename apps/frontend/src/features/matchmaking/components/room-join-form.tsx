import { type FormEvent, useState } from "react";
import { parseMatchId } from "../match-id.ts";

export function RoomJoinForm({
  onJoin,
  disabled = false,
}: {
  onJoin: (matchId: string) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("invitation");
    const matchId = typeof value === "string" ? parseMatchId(value) : null;
    if (matchId === null) {
      setError("部屋 ID またはこのサイトの招待 URL を入力してください。");
      return;
    }

    setError(null);
    onJoin(matchId);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">
        <span>部屋 ID または招待 URL</span>
        <input
          className="h-10 rounded border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
          disabled={disabled}
          name="invitation"
          placeholder="招待 URL を貼り付け"
          type="text"
        />
      </label>
      {error === null ? null : (
        <p
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="status"
        >
          {error}
        </p>
      )}
      <button
        className="h-10 rounded border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        disabled={disabled}
        type="submit"
      >
        部屋へ進む
      </button>
    </form>
  );
}
