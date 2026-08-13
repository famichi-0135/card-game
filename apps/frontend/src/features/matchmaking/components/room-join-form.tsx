import { type FormEvent, useState } from "react";
import { notifyMatchmakingError } from "./error-notifications.ts";
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
      const message = "部屋 ID またはこのサイトの招待 URL を入力してください。";
      setError(message);
      notifyMatchmakingError({
        description: message,
        title: "招待部屋に参加できません",
      });
      return;
    }

    setError(null);
    onJoin(matchId);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-[12px] font-medium tracking-[.06em] text-[#b9cad4]">
        <span>部屋 ID または招待 URL</span>
        <input
          className="h-11 border border-[#2f4a5e] bg-[#050d13]/90 px-3 text-[15px] text-[#edf5f9] outline-none placeholder:text-[#506776] transition focus:border-[#72b8e5] focus:ring-2 focus:ring-[#3b86b6]/25 disabled:cursor-not-allowed disabled:opacity-50"
          aria-invalid={error !== null}
          disabled={disabled}
          name="invitation"
          placeholder="招待 URL を貼り付け"
          type="text"
        />
      </label>
      <button
        className="h-11 border border-[#315b7e] bg-[linear-gradient(180deg,rgba(19,45,66,.96),rgba(6,16,25,.98))] px-4 text-sm font-medium tracking-[.06em] text-[#d8efff] shadow-[inset_0_1px_0_rgba(214,240,255,.13)] transition hover:border-[#76bcec] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ac4f3]"
        disabled={disabled}
        type="submit"
      >
        部屋へ進む
      </button>
    </form>
  );
}
