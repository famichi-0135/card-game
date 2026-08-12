import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { DiscardZone } from "./discard-zone.tsx";
import { DraggableHandCard } from "./hand-card.tsx";
import { SupportZone } from "./support-zone.tsx";
import { GameFrame } from "./game-ui/index.ts";

export function PlayerActionArea({
  availableActions,
  catalog,
  isInteractive,
  onOpenDiscard,
  onOpenSupport,
  onSelectCard,
  onSelectCardTarget,
  phaseInstruction,
  selectedCardInstanceId,
  self,
}: {
  availableActions: AvailableGameActions;
  catalog: PublicCardCatalog;
  isInteractive: boolean;
  onOpenDiscard: () => void;
  onOpenSupport: () => void;
  onSelectCard?: (cardInstanceId: string) => void;
  onSelectCardTarget?: (target: "discard-zone" | "support-zone") => boolean;
  phaseInstruction: string;
  selectedCardInstanceId?: string | null;
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
    <GameFrame
      as="section"
      aria-label="自分の操作と手札"
      className="grid h-[188px] grid-cols-[112px_112px_104px_minmax(0,1fr)_112px] items-stretch gap-[12px] p-[12px] text-[#e1e9eb]"
      data-board-region="player-actions"
      variant="gold"
    >
      <section aria-label="自分の捨て札" className="relative z-10 min-w-0">
        <DiscardZone
          canDiscard={canDiscard}
          count={self.discardPile.length}
          hasSelectedCard={selectedCardInstanceId != null}
          onOpen={onOpenDiscard}
          onSelectTarget={() => onSelectCardTarget?.("discard-zone") ?? false}
        />
      </section>
      <section
        aria-label="自分のサポートゾーン"
        className="relative z-10 min-w-0"
      >
        <SupportZone
          canPlaySupport={canPlaySupport}
          count={self.supportZone.length}
          hasSelectedCard={selectedCardInstanceId != null}
          onOpen={onOpenSupport}
          onSelectTarget={() => onSelectCardTarget?.("support-zone") ?? false}
        />
      </section>
      <div className="relative z-10 flex min-w-0 flex-col justify-between border-x border-white/[.1] px-[10px] py-[4px]">
        <div>
          <p className="text-[9px] font-medium tracking-[.12em] text-[#91a5ac]">
            HAND
          </p>
          <h1 className="mt-[3px] text-[17px] font-semibold">
            手札 {self.hand.length} 枚
          </h1>
        </div>
        <span className="text-[10px] leading-relaxed text-[#9fb0b5]">
          {phaseInstruction}
        </span>
        {selectedCardInstanceId == null ? null : (
          <span
            className="text-[10px] font-medium text-[#f0cf83]"
            role="status"
          >
            選択中のカード: {getCardName(selectedCardInstanceId, self, catalog)}
          </span>
        )}
      </div>
      <section
        aria-label="自分の手札"
        className="min-w-0 overflow-visible relative z-10"
      >
        <div className="flex h-full items-stretch justify-center gap-[10px] overflow-x-auto px-1 pb-[2px]">
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
              isSelected={selectedCardInstanceId === card.instanceId}
              onSelect={isInteractive ? onSelectCard : undefined}
            />
          ))}
        </div>
      </section>
      <section
        aria-label="自分の山札"
        className="relative z-10 flex min-w-0 items-stretch justify-center"
      >
        <div className="flex h-full w-full flex-col items-center justify-center border border-[#907140]/80 bg-[#0a0e0d]/90 p-3 text-center text-sm shadow-[inset_0_0_15px_rgba(0,0,0,.8)] [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)]">
          <p className="text-[10px] tracking-[.1em] text-[#b8a275]">山札</p>
          <strong className="mt-1 font-mono text-[23px] text-[#f0d08a]">
            {self.deckCount}
          </strong>
        </div>
      </section>
    </GameFrame>
  );
}

function getCardName(
  cardInstanceId: string,
  self: PlayerGameView["self"],
  catalog: PublicCardCatalog,
): string {
  const card = self.hand.find(
    (candidate) => candidate.instanceId === cardInstanceId,
  );
  return card === undefined
    ? "カード"
    : (catalog.definitions[card.definitionId]?.name ?? "カード");
}
