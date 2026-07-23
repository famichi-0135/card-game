import { useEffect, useRef, useState } from "react";
import type { PublicEventFeedItem } from "./use-public-event-feed.ts";

const EVENT_PRESENTATION_DURATION_MS = 1_600;

export function usePublicEventPlayback({
  events,
  gameId,
  prefersReducedMotion,
}: {
  events: readonly PublicEventFeedItem[];
  gameId: string;
  prefersReducedMotion: boolean;
}) {
  const latestSequenceRef = useRef<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<PublicEventFeedItem | null>(
    null,
  );
  const [queue, setQueue] = useState<PublicEventFeedItem[]>([]);

  useEffect(() => {
    latestSequenceRef.current = null;
    setActiveEvent(null);
    setQueue([]);
  }, [gameId]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveEvent(null);
      setQueue([]);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const newest = events[events.length - 1];
    if (newest === undefined) {
      return;
    }

    const latestSequence = latestSequenceRef.current;
    latestSequenceRef.current = newest.sequence;
    if (prefersReducedMotion) {
      return;
    }

    if (latestSequence === null) {
      setQueue([newest]);
      return;
    }

    const received = events.filter((event) => event.sequence > latestSequence);
    if (received.length > 0) {
      setQueue((current) => [...current, ...received]);
    }
  }, [events, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || activeEvent !== null || queue.length === 0) {
      return;
    }

    setActiveEvent(queue[0] ?? null);
    setQueue((current) => current.slice(1));
  }, [activeEvent, prefersReducedMotion, queue]);

  useEffect(() => {
    if (activeEvent === null) {
      return;
    }

    const timer = window.setTimeout(
      () => setActiveEvent(null),
      EVENT_PRESENTATION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeEvent]);

  return activeEvent;
}
