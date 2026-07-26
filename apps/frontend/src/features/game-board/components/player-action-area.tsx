import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { DiscardZone } from "./discard-zone.tsx";
import { DraggableHandCard } from "./hand-card.tsx";
import { SupportZone } from "./support-zone.tsx";

export function PlayerActionArea({
  availableActions,
  catalog,
  isInteractive,
  onOpenDiscard,
  onOpenSupport,
  phaseInstruction,
  self,
}: {
  availableActions: AvailableGameActions;
  catalog: PublicCardCatalog;
  isInteractive: boolean;
  onOpenDiscard: () => void;
  onOpenSupport: () => void;
  phaseInstruction: string;
  self: PlayerGameView["self"];
}) {
  const canDiscard =
    isInteractive &&
    Object.values(availableActions.handCards).some(
      (actions) => actions.discard.available,
    );
  const canPlaySupport =
    isInteractive &&
    Object.values(availableActions.handCards).some(
      (actions) => actions.playSupport.available,
    );

  return (
    <section
      aria-label="自分の操作と手札"
      className="grid h-[164px] grid-cols-[112px_112px_96px_minmax(0,1fr)_112px] items-stretch gap-3 rounded-md border border-slate-300 bg-white p-2"
      data-board-region="player-actions"
    >
      <section aria-label="自分の捨て札" className="min-w-0">
        <DiscardZone
          canDiscard={canDiscard}
          count={self.discardPile.length}
          onOpen={onOpenDiscard}
        />
      </section>
      <section aria-label="自分のサポートゾーン" className="min-w-0">
        <SupportZone
          canPlaySupport={canPlaySupport}
          count={self.supportZone.length}
          onOpen={onOpenSupport}
        />
      </section>
      <div className="flex min-w-0 flex-col justify-between py-1">
        <div>
          <p className="text-xs font-medium text-slate-500">HAND</p>
          <h1 className="text-base font-semibold">
            手札 {self.hand.length} 枚
          </h1>
        </div>
        <span className="text-xs text-slate-500">{phaseInstruction}</span>
      </div>
      <section aria-label="自分の手札" className="min-w-0 overflow-visible">
        <div className="flex h-full items-stretch justify-center gap-3 px-1">
          {self.hand.map((card) => (
            <DraggableHandCard
              key={card.instanceId}
              actions={
                isInteractive
                  ? availableActions.handCards[card.instanceId]
                  : undefined
              }
              card={card}
              catalog={catalog}
            />
          ))}
        </div>
      </section>
      <section
        aria-label="自分の山札"
        className="flex min-w-0 items-stretch justify-center"
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-slate-300 p-3 text-center text-sm">
          <p className="text-slate-500">山札</p>
          <strong className="text-lg">{self.deckCount}</strong>
        </div>
      </section>
    </section>
  );
}
