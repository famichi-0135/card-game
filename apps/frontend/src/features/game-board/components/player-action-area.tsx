import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { DiscardZone } from "./discard-zone.tsx";
import { DraggableHandCard } from "./hand-card.tsx";
import { SupportZone } from "./support-zone.tsx";
import { CardBack, GameFrame } from "./game-ui/index.ts";

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
      className="grid h-[200px] grid-cols-[112px_112px_minmax(0,1fr)_112px] items-stretch gap-[12px] p-[12px] text-[#e1e9eb]"
      data-board-region="player-actions"
      variant="gold"
    >
      <section
        aria-label="自分の捨て札"
        className="relative z-10 min-h-0 min-w-0"
      >
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
        className="relative z-10 min-h-0 min-w-0"
      >
        <SupportZone
          canPlaySupport={canPlaySupport}
          count={self.supportZone.length}
          hasSelectedCard={selectedCardInstanceId != null}
          onOpen={onOpenSupport}
          onSelectTarget={() => onSelectCardTarget?.("support-zone") ?? false}
        />
      </section>
      <section
        aria-label="自分の手札"
        className="min-w-0 overflow-visible relative z-10"
      >
        <div className="flex h-full min-h-0 flex-col gap-[5px] border-x border-white/[.08] px-[12px]">
          <div className="relative flex items-center gap-[10px]">
            <span className="flex flex-1 items-center justify-center gap-[10px]">
              <HandLabelRule />
              <span className="shrink-0 text-[10px] font-medium tracking-[.2em] text-[#d8c9a4]">
                自分の手札
                <span className="ml-[6px] font-mono text-[9px] tracking-normal text-[#9a8f74]">
                  {self.hand.length} 枚
                </span>
              </span>
              <HandLabelRule flip />
            </span>
            <span className="absolute right-0 flex max-w-[46%] items-center justify-end gap-[10px] text-[9px] text-[#9fb0b5]">
              {selectedCardInstanceId == null ? null : (
                <span
                  className="truncate font-medium text-[#f0cf83]"
                  role="status"
                >
                  選択中のカード:{" "}
                  {getCardName(selectedCardInstanceId, self, catalog)}
                </span>
              )}
              <span className="shrink-0 truncate">{phaseInstruction}</span>
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-stretch justify-center gap-[10px] overflow-x-auto px-1 pb-[2px]">
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
        </div>
      </section>
      <section
        aria-label="自分の山札"
        className="relative z-10 flex min-h-0 min-w-0 flex-col gap-[5px]"
      >
        <div className="flex items-baseline justify-between px-[2px]">
          <span className="text-[9px] font-medium tracking-[.14em] text-[#b8a275]">
            山札
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[#f0d08a]">
            {self.deckCount}
            <span className="ml-[2px] text-[8px] text-[#b8a275]">枚</span>
          </span>
        </div>
        <CardBack className="min-h-0 flex-1" />
      </section>
    </GameFrame>
  );
}

function HandLabelRule({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={
        "h-[8px] w-[34px] shrink-0 text-[#8a764f]" + (flip ? " -scale-x-100" : "")
      }
      preserveAspectRatio="none"
      viewBox="0 0 34 8"
    >
      <path d="M0 4H26" stroke="#000" strokeWidth="3" />
      <path d="M0 4H26" stroke="currentColor" strokeOpacity=".7" />
      <path d="M30 1L33 4L30 7L27 4Z" fill="#0a0c0e" stroke="currentColor" />
    </svg>
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
