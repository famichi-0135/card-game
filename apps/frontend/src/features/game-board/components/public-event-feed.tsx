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
    <>
      <div className="col-span-3 flex min-h-5 min-w-0 items-center">
        {activeEvent === null ? null : (
          <output
            aria-live="polite"
            className="flex min-w-0 items-center border-l-2 border-slate-700 pl-2 text-sm font-medium text-slate-800 motion-safe:animate-pulse motion-reduce:animate-none"
            role="status"
          >
            <span className="truncate" key={activeEvent.sequence}>
              {activeEvent.message}
            </span>
          </output>
        )}
      </div>
      <ol
        aria-label="最近の公開イベント"
        className="col-span-3 flex min-w-0 gap-4 overflow-hidden border-t border-slate-200 pt-2 text-xs text-slate-600"
      >
        {events.map((event) => (
          <li className="min-w-0 truncate" key={event.sequence}>
            {event.message}
          </li>
        ))}
      </ol>
    </>
  );
}
