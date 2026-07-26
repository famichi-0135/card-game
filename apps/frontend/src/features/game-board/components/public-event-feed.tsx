import { useEffect, useRef, useState } from "react";
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

  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        detailsRef.current &&
        !detailsRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (events.length === 0) {
    return null;
  }

  return (
    <details
      ref={detailsRef}
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className="relative min-w-0 rounded border border-slate-200 bg-slate-50 px-2 py-2"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-slate-700 marker:content-none">
        <span className="shrink-0 text-xs text-slate-500">公開イベント</span>
        <span className="truncate">
          {activeEvent === null ? "履歴を表示" : activeEvent.message}
        </span>
      </summary>
      <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-64 w-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
        <ol
          aria-label="最近の公開イベント"
          className="grid gap-1 text-xs text-slate-600"
        >
          {events.map((event) => (
            <li
              key={event.sequence}
              className="border-b border-slate-100 pb-1 last:border-0 last:pb-0"
            >
              {event.message}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
