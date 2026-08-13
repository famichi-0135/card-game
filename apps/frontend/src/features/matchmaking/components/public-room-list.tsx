import type { PublicMatchLobbySummary } from "@disastar/contracts/match";
import { useEffect, useRef } from "react";
import { notifyMatchmakingError } from "./error-notifications.ts";

const factionLabels = {
  disaster: "災害側",
  countermeasure: "対策側",
} as const;

export function PublicRoomList({
  error,
  isLoading,
  matches,
  onRefresh,
  onSelect,
}: {
  error: string | null;
  isLoading: boolean;
  matches: readonly PublicMatchLobbySummary[];
  onRefresh: () => void;
  onSelect: (matchId: string) => void;
}) {
  const notifiedError = useRef<string | null>(null);

  useEffect(() => {
    if (error === null || error === notifiedError.current) {
      return;
    }

    notifiedError.current = error;

    notifyMatchmakingError({
      description: error,
      title: "公開部屋を取得できません",
    });
  }, [error]);

  return (
    <section className="grid gap-4" aria-labelledby="public-room-list-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" id="public-room-list-title">
            募集中の対戦部屋
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#91a5b4]">
            一覧から部屋を選び、ロールを確認して参加できます。
          </p>
        </div>
        <button
          className="h-9 border border-[#34566e] px-3 text-xs font-medium tracking-[.06em] text-[#cce8fa] transition hover:border-[#72b7e5] hover:bg-[#102536] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
          onClick={onRefresh}
          type="button"
        >
          更新
        </button>
      </div>
      {isLoading ? (
        <p
          className="border border-[#2a3d4b] bg-[#071018]/70 px-4 py-6 text-sm text-[#9fb1bd]"
          role="status"
        >
          公開部屋を読み込んでいます。
        </p>
      ) : matches.length === 0 ? (
        <p className="border border-[#2a3d4b] bg-[#071018]/70 px-4 py-6 text-sm text-[#9fb1bd]">
          現在参加できる公開部屋はありません。
        </p>
      ) : (
        <ul className="grid gap-3" aria-live="polite">
          {matches.map((match) => (
            <li key={match.matchId}>
              <article className="border border-[#29404f] bg-[linear-gradient(145deg,rgba(11,23,32,.94),rgba(4,10,15,.96))] p-4 shadow-[inset_0_1px_0_rgba(226,244,255,.05)]">
                <p className="font-medium text-[#e2edf2]">
                  {match.isOwner
                    ? "あなたが作成した部屋"
                    : `${factionLabels[match.ownerFaction]}が募集中`}
                </p>
                <p className="mt-2 text-sm text-[#91a5b4]">
                  {remainingMinutesLabel(match.expiresAt)}
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    className={`h-9 border px-3 text-xs font-medium tracking-[.05em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced] ${match.isOwner ? "border-[#526570] text-[#c7d6dd] hover:border-[#8ca3af]" : "border-[#3e7196] bg-[#0d2739] text-[#d5efff] hover:border-[#79bbe7]"}`}
                    onClick={() => onSelect(match.matchId)}
                    type="button"
                  >
                    {match.isOwner ? "待機部屋を開く" : "部屋を開く"}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function remainingMinutesLabel(expiresAt: number): string {
  const remainingMilliseconds = Math.max(0, expiresAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMilliseconds / 60_000));
  return `待機期限まで約${minutes}分`;
}
