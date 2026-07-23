import type {
  AvailableGameActions,
  EffectInput,
  PlayerGameView,
  PublicCardCatalog,
  VisibleAttackGroup,
} from "@disastar/game-engine";
import { type ReactNode, useEffect, useState } from "react";
import { AttackGroupRow } from "./components/attack-group-row.tsx";
import {
  ConnectionStatus,
  type GameConnectionState,
} from "./components/connection-status.tsx";
import { DesktopOnlyNotice } from "./components/desktop-only-notice.tsx";
import { DiscardZone } from "./components/discard-zone.tsx";
import { GameResultDialog } from "./components/game-result-dialog.tsx";
import { DraggableHandCard } from "./components/hand-card.tsx";
import { ManaPanel } from "./components/mana-panel.tsx";
import { OpponentZone } from "./components/opponent-zone.tsx";
import { PhaseEndDialog } from "./components/phase-end-dialog.tsx";
import { PlayerSummary } from "./components/player-summary.tsx";
import { PublicEventFeed } from "./components/public-event-feed.tsx";
import { SupportTargetDialog } from "./components/support-target-dialog.tsx";
import { SupportZone } from "./components/support-zone.tsx";
import { ZoneDialog, type ZoneDialogState } from "./components/zone-dialog.tsx";
import type { PendingSupportPlay } from "./hooks/use-game-board-actions.ts";
import type { PublicEventFeedItem } from "./hooks/use-public-event-feed.ts";
import { getPhasePresentation } from "./phase-presentation.ts";

export function GameBoardView({
  accountAction,
  availableActions,
  catalog,
  commandError,
  commandPending,
  connectionState,
  isInteractive,
  onCancelSupportPlay,
  onConfirmSupportPlay,
  onFinishPhase,
  opponentOnline,
  onRetryCommand,
  onResynchronize,
  pendingSupportPlay,
  publicEvents,
  view,
}: {
  accountAction?: ReactNode;
  availableActions: AvailableGameActions;
  catalog: PublicCardCatalog;
  commandError: string | null;
  commandPending: boolean;
  connectionState: GameConnectionState;
  isInteractive: boolean;
  onCancelSupportPlay: () => void;
  onConfirmSupportPlay: (effectInputs: EffectInput[]) => void;
  onFinishPhase: () => void;
  opponentOnline: boolean;
  onRetryCommand?: () => void;
  onResynchronize?: () => void;
  pendingSupportPlay: PendingSupportPlay | null;
  publicEvents: readonly PublicEventFeedItem[];
  view: PlayerGameView;
}) {
  const [zoneDialog, setZoneDialog] = useState<ZoneDialogState | null>(null);
  const [isPhaseEndDialogOpen, setIsPhaseEndDialogOpen] = useState(false);
  const remainingSeconds = useRemainingSeconds(view.phaseDeadlineAt);
  const finishAction =
    view.phase === "support"
      ? availableActions.finishSupport
      : availableActions.finishPlacement;
  const canFinishPhase =
    isInteractive && isFinishablePhase(view.phase) && finishAction.available;
  const finishActionLabel =
    view.phase === "support" ? "サポート終了" : "配置終了";
  const phasePresentation = getPhasePresentation(view);
  const isFinished = view.status === "finished";
  const commandMessage = commandPending ? "操作を送信しています" : commandError;
  const handInstruction =
    view.phase === "support"
      ? "ドラッグしてサポートを使用"
      : "ドラッグして配置・連鎖";

  const openZoneDialog = (state: ZoneDialogState) => setZoneDialog(state);
  const openAttackGroup = (group: VisibleAttackGroup) =>
    openZoneDialog({
      title: `自分の攻撃グループ ${group.slotIndex + 1}`,
      description: `必要みなもと ${group.requiredMana} / 攻撃力 ${group.currentPower}`,
      cards: group.cards,
    });

  return (
    <>
      <main className="h-dvh min-w-[1140px] overflow-hidden bg-slate-100 p-4 max-[1179px]:hidden max-[719px]:hidden">
        <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
          <OpponentZone
            deckCount={view.opponent.deckCount}
            discardCount={view.opponent.discardPile.length}
            gameId={view.gameId}
            handCount={view.opponent.handCount}
            opponentOnline={opponentOnline}
            stateVersion={view.stateVersion}
            onOpenDiscard={() =>
              openZoneDialog({
                title: "相手の捨て札",
                description: "公開済みのカード",
                cards: view.opponent.discardPile,
              })
            }
          />

          <section
            className="grid min-h-0 grid-cols-[210px_minmax(0,1fr)_210px] gap-3 rounded-md border border-slate-300 bg-white p-3"
            aria-label="バトルゾーン"
          >
            <PlayerSummary
              player={view.opponent}
              label="相手"
              onOpenDiscard={() =>
                openZoneDialog({
                  title: "相手の捨て札",
                  description: "公開済みのカード",
                  cards: view.opponent.discardPile,
                })
              }
            />

            <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3">
              <AttackGroupRow
                catalog={catalog}
                groups={view.opponent.attackGroups}
                label="相手の攻撃グループ"
                perspective="opponent"
              />

              <section className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md border border-slate-300 px-4 py-3 text-sm">
                <div>
                  <span className="text-slate-500">ROUND </span>
                  <strong>{view.round}</strong>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <span className="text-slate-500">現在のフェーズ</span>
                  <strong>{phasePresentation.label}</strong>
                  <span className="rounded border border-slate-300 px-2 py-1 font-mono text-xs">
                    {formatSeconds(remainingSeconds)}
                  </span>
                  <ConnectionStatus
                    onResynchronize={onResynchronize}
                    state={connectionState}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span
                    aria-live="polite"
                    className="truncate text-slate-600"
                    role="status"
                  >
                    {commandMessage ?? phasePresentation.instruction}
                  </span>
                  {onRetryCommand === undefined ? null : (
                    <button
                      className="shrink-0 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      onClick={onRetryCommand}
                      type="button"
                    >
                      再試行
                    </button>
                  )}
                  <button
                    className="shrink-0 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    disabled={!canFinishPhase}
                    onClick={() => setIsPhaseEndDialogOpen(true)}
                    type="button"
                  >
                    {finishActionLabel}
                  </button>
                  {accountAction}
                </div>
                <PublicEventFeed events={publicEvents} gameId={view.gameId} />
              </section>

              <AttackGroupRow
                catalog={catalog}
                groups={view.self.attackGroups}
                label="自分の攻撃グループ"
                perspective="self"
                availableActions={isInteractive ? availableActions : undefined}
                onOpenGroup={openAttackGroup}
              />
            </section>

            <ManaPanel player={view.self} />
          </section>

          <section className="grid grid-cols-[210px_minmax(0,1fr)_210px] gap-3 rounded-md border border-slate-300 bg-white p-3">
            <section
              className="grid grid-cols-2 gap-2"
              aria-label="自分のカードゾーン"
            >
              <DiscardZone
                canDiscard={
                  isInteractive &&
                  Object.values(availableActions.handCards).some(
                    (actions) => actions.discard.available,
                  )
                }
                count={view.self.discardPile.length}
                onOpen={() =>
                  openZoneDialog({
                    title: "自分の捨て札",
                    description: "このゲームで使用または破棄したカード",
                    cards: view.self.discardPile,
                  })
                }
              />
              <SupportZone
                canPlaySupport={
                  isInteractive &&
                  Object.values(availableActions.handCards).some(
                    (actions) => actions.playSupport.available,
                  )
                }
                count={view.self.supportZone.length}
                onOpen={() =>
                  openZoneDialog({
                    title: "自分のサポートグループ",
                    description: "現在場に出ているサポートカード",
                    cards: view.self.supportZone,
                  })
                }
              />
            </section>

            <section aria-label="自分の手札">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">HAND</p>
                  <h1 className="text-base font-semibold">
                    手札 {view.self.hand.length} 枚
                  </h1>
                </div>
                <span className="text-xs text-slate-500">
                  {handInstruction}
                </span>
              </div>
              <div className="flex min-h-[148px] items-end justify-center gap-3">
                {view.self.hand.map((card) => (
                  <DraggableHandCard
                    key={card.instanceId}
                    card={card}
                    catalog={catalog}
                    actions={
                      isInteractive
                        ? availableActions.handCards[card.instanceId]
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>

            <section
              className="flex items-center justify-center"
              aria-label="自分の山札"
            >
              <div className="w-full rounded-md border border-slate-300 p-3 text-center text-sm">
                <p className="text-slate-500">山札</p>
                <strong className="text-lg">{view.self.deckCount}</strong>
              </div>
            </section>
          </section>
        </div>
      </main>

      <DesktopOnlyNotice />
      {isFinished ? (
        <GameResultDialog view={view} />
      ) : (
        <>
          {zoneDialog === null ? null : (
            <ZoneDialog
              catalog={catalog}
              state={zoneDialog}
              onClose={() => setZoneDialog(null)}
            />
          )}
          {!isPhaseEndDialogOpen ? null : (
            <PhaseEndDialog
              actionLabel={finishActionLabel}
              onCancel={() => setIsPhaseEndDialogOpen(false)}
              onConfirm={() => {
                onFinishPhase();
                setIsPhaseEndDialogOpen(false);
              }}
            />
          )}
          {pendingSupportPlay === null ? null : (
            <SupportTargetDialog
              cardName={
                catalog.definitions[pendingSupportPlay.card.definitionId]
                  ?.name ?? "サポートカード"
              }
              effectSelections={pendingSupportPlay.effectSelections}
              onCancel={onCancelSupportPlay}
              onConfirm={onConfirmSupportPlay}
              view={view}
            />
          )}
        </>
      )}
    </>
  );
}

function useRemainingSeconds(deadlineAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return deadlineAt === null
    ? 0
    : Math.max(0, Math.ceil((deadlineAt - now) / 1_000));
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function isFinishablePhase(phase: PlayerGameView["phase"]): boolean {
  return (
    phase === "firstPlayerPlacement" ||
    phase === "secondPlayerPlacement" ||
    phase === "support"
  );
}
