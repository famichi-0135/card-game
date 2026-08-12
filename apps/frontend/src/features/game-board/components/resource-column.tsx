import type { PlayerGameView } from "@disastar/game-engine";
import { useState, type ReactNode } from "react";
import { Archive, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { PublicEventFeedItem } from "../hooks/use-public-event-feed.ts";
import { ManaPanel } from "./mana-panel.tsx";
import { PublicEventFeed } from "./public-event-feed.tsx";
import { GameFrame, SecondaryGameButton } from "./game-ui/index.ts";

export function ResourceColumn({
  gameId,
  onOpenOpponentDiscard,
  onOpenOpponentSupport,
  opponent,
  publicEvents,
  self,
}: {
  gameId: string;
  onOpenOpponentDiscard: () => void;
  onOpenOpponentSupport: () => void;
  opponent: PlayerGameView["opponent"];
  publicEvents: readonly PublicEventFeedItem[];
  self: PlayerGameView["self"];
}) {
  const [openEventSections, setOpenEventSections] = useState<string[]>([]);
  const isEventHistoryOpen = openEventSections.includes("public-events");
  const latestEvent = publicEvents.at(-1)?.message;

  return (
    <aside
      aria-label="みなもとと公開イベント"
      className={cn(
        "grid h-full min-h-0 gap-[10px] overflow-visible transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
        isEventHistoryOpen
          ? "grid-rows-[clamp(144px,18vh,172px)_minmax(150px,1fr)_clamp(218px,32vh,306px)]"
          : "grid-rows-[clamp(144px,18vh,172px)_minmax(0,1fr)_54px]",
      )}
      data-board-region="resources"
      data-event-feed-state={isEventHistoryOpen ? "expanded" : "collapsed"}
    >
      <div
        className="min-h-0"
        data-resource-panel="opponent"
        data-resource-priority="secondary"
      >
        <ManaPanel
          compact
          footer={
            <div
              className="grid h-full grid-cols-2 gap-[12px]"
              data-opponent-public-zones
            >
              <OpponentPublicZoneButton
                count={opponent.supportZone.length}
                icon={
                  <ShieldCheck aria-hidden="true" size={14} strokeWidth={1.8} />
                }
                label="サポート"
                onClick={onOpenOpponentSupport}
                zone="support"
              />
              <OpponentPublicZoneButton
                count={opponent.discardPile.length}
                icon={
                  <Archive aria-hidden="true" size={14} strokeWidth={1.8} />
                }
                label="捨て札"
                onClick={onOpenOpponentDiscard}
                zone="discard"
              />
            </div>
          }
          label="相手"
          perspective="opponent"
          player={opponent}
        />
      </div>

      <div
        className="min-h-0"
        data-resource-panel="self"
        data-resource-priority="primary"
      >
        <ManaPanel label="自分" perspective="self" player={self} />
      </div>

      <GameFrame
        as="section"
        aria-label="公開イベント履歴"
        className="relative min-h-0 overflow-hidden border border-[#365262] bg-[#050c11]/95 shadow-[inset_0_0_20px_rgba(0,0,0,.88)] [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)] before:pointer-events-none before:absolute before:inset-[3px] before:border before:border-white/[.04]"
        variant="gray"
      >
        <Accordion
          className="relative z-10 h-full"
          multiple
          onValueChange={setOpenEventSections}
          value={openEventSections}
        >
          <AccordionItem
            className={cn(
              "h-full min-h-0 border-0",
              isEventHistoryOpen && "flex flex-col",
            )}
            value="public-events"
          >
            <AccordionTrigger className="min-h-[54px] border-0 px-[13px] py-[8px] no-underline hover:no-underline focus-visible:border-[#6a9bb5] focus-visible:ring-0">
              <span className="min-w-0 text-left">
                <span className="block text-[12px] font-medium tracking-[.07em] text-[#d8dedd]">
                  公開イベント
                </span>
                <span className="mt-[3px] block truncate text-[9px] font-normal text-[#718189]">
                  {latestEvent === undefined
                    ? "イベントはありません"
                    : `LATEST · ${latestEvent}`}
                </span>
              </span>
              <span className="mr-[7px] shrink-0 text-[9px] tracking-[.08em] text-[#7ea9bd]">
                {isEventHistoryOpen ? "閉じる" : `${publicEvents.length}件`}
              </span>
            </AccordionTrigger>
            <AccordionContent className="min-h-0 flex-1 pb-0 [&>div]:flex [&>div]:h-full [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-0">
              {publicEvents.length === 0 ? (
                <p className="p-[14px] text-[11px] text-[#788890]">
                  公開イベントはありません
                </p>
              ) : (
                <PublicEventFeed events={publicEvents} gameId={gameId} />
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </GameFrame>
    </aside>
  );
}

function OpponentPublicZoneButton({
  count,
  icon,
  label,
  onClick,
  zone,
}: {
  count: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  zone: "discard" | "support";
}) {
  return (
    <SecondaryGameButton
      aria-label={`相手の${label}`}
      className="grid h-full min-w-0 grid-cols-[18px_minmax(0,1fr)_20px] items-center gap-[4px] px-[8px] text-left"
      data-opponent-zone={zone}
      onClick={onClick}
    >
      <span
        className="grid w-full min-w-0 grid-cols-[18px_minmax(0,1fr)_20px] items-center gap-[4px]"
        data-opponent-zone-content={zone}
      >
        <span className="text-[#d0ad6d]">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[7px] tracking-[.09em] text-[#88979d]">
            公開済み
          </span>
          <strong className="block truncate text-[10px] tracking-[.04em] text-[#e7dcc4]">
            {label}
          </strong>
        </span>
        <strong className="text-right text-[17px] leading-none text-[#efc779]">
          {count}
        </strong>
      </span>
    </SecondaryGameButton>
  );
}
