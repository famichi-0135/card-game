import type { PublicEventFeedItem } from "../hooks/use-public-event-feed.ts";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.ts";
import { usePublicEventPlayback } from "../hooks/use-public-event-playback.ts";

export function PublicEventFeed({
  events,
  gameId,
}: {
  events: readonly PublicEventFeedItem[];
  gameId: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const activeEvent = usePublicEventPlayback({
    events,
    gameId,
    prefersReducedMotion,
  });

  if (events.length === 0) {
    return null;
  }

  return (
    <details className="min-w-0 rounded border border-slate-200 bg-slate-50 px-2 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-slate-700 marker:content-none">
        <span className="shrink-0 text-xs text-slate-500">公開イベント</span>
        <span className="truncate">
          {activeEvent === null ? "履歴を表示" : activeEvent.message}
        </span>
      </summary>
      <ol
        aria-label="最近の公開イベント"
        className="mt-2 grid gap-1 border-t border-slate-200 pt-2 text-xs text-slate-600"
      >
        {events.map((event) => (
          <li key={event.sequence}>{event.message}</li>
        ))}
      </ol>
    </details>
  );
}
