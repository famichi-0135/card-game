import type { PublicEventFeedItem } from "../hooks/use-public-event-feed.ts";

export function PublicEventFeed({
  events,
}: {
  events: readonly PublicEventFeedItem[];
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <ol
      aria-label="最近の公開イベント"
      aria-live="polite"
      className="col-span-3 flex min-w-0 gap-4 overflow-hidden border-t border-slate-200 pt-2 text-xs text-slate-600"
    >
      {events.map((event) => (
        <li className="min-w-0 truncate" key={event.sequence}>
          {event.message}
        </li>
      ))}
    </ol>
  );
}
