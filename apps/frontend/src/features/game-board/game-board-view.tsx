import type {
  AvailableGameActions,
  EffectInput,
  PlayerGameView,
  PublicCardCatalog,
  VisibleAttackGroup,
} from "@disastar/game-engine";
import { type ReactNode, useEffect, useState } from "react";
import { CardField } from "./components/card-field.tsx";
import { type GameConnectionState } from "./components/connection-status.tsx";
import { DesktopOnlyNotice } from "./components/desktop-only-notice.tsx";
import { GameProgressBar } from "./components/game-progress-bar.tsx";
import { GameResultDialog } from "./components/game-result-dialog.tsx";
import { PhaseEndDialog } from "./components/phase-end-dialog.tsx";
import { PlayerActionArea } from "./components/player-action-area.tsx";
import { PlayerStatusColumn } from "./components/player-status-column.tsx";
import { ResourceColumn } from "./components/resource-column.tsx";
import { SupportTargetDialog } from "./components/support-target-dialog.tsx";
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
      <main className="h-dvh min-w-[1180px] overflow-hidden bg-slate-100 p-4 max-[1179px]:hidden max-[719px]:hidden">
        <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
          <GameProgressBar
            accountAction={accountAction}
            canFinishPhase={canFinishPhase}
            commandMessage={commandMessage}
            connectionState={connectionState}
            finishActionLabel={finishActionLabel}
            gameId={view.gameId}
            onFinishPhase={() => setIsPhaseEndDialogOpen(true)}
            onResynchronize={onResynchronize}
            onRetryCommand={onRetryCommand}
            phaseInstruction={phasePresentation.instruction}
            phaseLabel={phasePresentation.label}
            publicEvents={publicEvents}
            remainingTime={formatSeconds(remainingSeconds)}
            round={view.round}
            stateVersion={view.stateVersion}
          />

          <section
            className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)_220px] gap-3 rounded-md border border-slate-300 bg-white p-3"
            aria-label="バトルゾーン"
          >
            <PlayerStatusColumn
              opponent={view.opponent}
              opponentOnline={opponentOnline}
              self={view.self}
              selfPhaseLabel={phasePresentation.label}
            />

            <CardField
              availableActions={isInteractive ? availableActions : undefined}
              catalog={catalog}
              onOpenSelfGroup={openAttackGroup}
              opponentGroups={view.opponent.attackGroups}
              selfGroups={view.self.attackGroups}
            />

            <ResourceColumn
              onOpenOpponentDiscard={() =>
                openZoneDialog({
                  title: "相手の捨て札",
                  description: "相手がこのゲームで使用または破棄したカード",
                  cards: view.opponent.discardPile,
                })
              }
              opponent={view.opponent}
              self={view.self}
            />
          </section>

          <PlayerActionArea
            availableActions={availableActions}
            catalog={catalog}
            isInteractive={isInteractive}
            onOpenDiscard={() =>
              openZoneDialog({
                title: "自分の捨て札",
                description: "このゲームで使用または破棄したカード",
                cards: view.self.discardPile,
              })
            }
            onOpenSupport={() =>
              openZoneDialog({
                title: "自分のサポートグループ",
                description: "現在場に出ているサポートカード",
                cards: view.self.supportZone,
              })
            }
            phaseInstruction={handInstruction}
            self={view.self}
          />
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
