import { DragDropProvider } from "@dnd-kit/react";
import type {
  GameCommand,
  PlayerGameView,
  PlayerVisibleEventEnvelope,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { ApiClientError } from "../../app/api-client.ts";
import type { GameConnectionState } from "./components/connection-status.tsx";
import { GameBoardView } from "./game-board-view.tsx";
import type { GameBoardFixture } from "./fixtures/game-board-fixture.ts";
import {
  useGameCommand,
  useGameSnapshot,
  usePublicCardCatalog,
} from "./hooks/use-game-board-data.ts";
import { useGameBoardActions } from "./hooks/use-game-board-actions.ts";
import { useOnlineStatus } from "./hooks/use-online-status.ts";
import { usePublicEventFeed } from "./hooks/use-public-event-feed.ts";

export function FixtureGameBoard({ fixture }: { fixture: GameBoardFixture }) {
  return (
    <GameBoardContent
      catalog={fixture.catalog}
      events={fixture.events}
      latestEventSequence={fixture.latestEventSequence}
      preview
      view={fixture.view}
    />
  );
}

export function GameBoard({
  accountAction,
  gameId,
}: {
  accountAction?: ReactNode;
  gameId: string;
}) {
  const snapshot = useGameSnapshot(gameId);
  const catalog = usePublicCardCatalog(snapshot.data?.view.cardCatalogVersion);
  const command = useGameCommand(gameId);
  const isOnline = useOnlineStatus();

  if (snapshot.isPending) {
    return (
      <GameBoardMessage
        title={isOnline ? "対戦サーバーに接続しています" : "オフラインです"}
      />
    );
  }
  if (snapshot.isError && snapshot.data === undefined) {
    return <GameBoardMessage title={getSnapshotErrorMessage(snapshot.error)} />;
  }
  if (snapshot.data === undefined) {
    return <GameBoardMessage title="対戦データを取得できませんでした" />;
  }
  if (catalog.isPending) {
    return <GameBoardMessage title="カードカタログを読み込んでいます" />;
  }
  if (catalog.isError || catalog.data === undefined) {
    return <GameBoardMessage title="カードカタログを取得できませんでした" />;
  }

  return (
    <GameBoardContent
      catalog={catalog.data.catalog}
      accountAction={accountAction}
      commandError={command.errorMessage}
      commandPending={command.isPending}
      connectionState={getConnectionState({
        isOnline,
        isResynchronizing: snapshot.isResynchronizing,
        resynchronizationError: snapshot.resynchronizationError,
        snapshotError: snapshot.error,
      })}
      events={snapshot.data.events}
      latestEventSequence={snapshot.data.latestEventSequence}
      onCommand={command.submit}
      onRetryCommand={command.canRetry ? command.retry : undefined}
      onResynchronize={snapshot.resynchronize}
      view={snapshot.data.view}
    />
  );
}

function GameBoardContent({
  accountAction,
  catalog,
  commandError,
  commandPending = false,
  connectionState = "connected",
  events = [],
  latestEventSequence = 0,
  onCommand,
  onRetryCommand,
  onResynchronize,
  preview = false,
  view,
}: {
  accountAction?: ReactNode;
  catalog: PublicCardCatalog;
  commandError?: string | null;
  commandPending?: boolean;
  connectionState?: GameConnectionState;
  events?: readonly PlayerVisibleEventEnvelope[];
  latestEventSequence?: number;
  onCommand?: (command: GameCommand) => void;
  onRetryCommand?: () => void;
  onResynchronize?: () => Promise<void>;
  preview?: boolean;
  view: PlayerGameView;
}) {
  const resynchronizationInFlight = useRef(false);
  const {
    availableActions,
    cancelSupportPlay,
    confirmSupportPlay,
    currentView,
    finishPhase,
    handleDragEnd,
    pendingSupportPlay,
  } = useGameBoardActions({ catalog, onCommand, preview, view });
  const {
    acknowledgeResynchronization,
    items: publicEvents,
    needsResynchronization,
  } = usePublicEventFeed({
    events,
    gameId: view.gameId,
    latestEventSequence,
    viewerPlayerId: view.viewerPlayerId,
  });
  const resynchronize = useCallback(async () => {
    if (onResynchronize === undefined || resynchronizationInFlight.current) {
      return;
    }

    resynchronizationInFlight.current = true;
    try {
      await onResynchronize();
      acknowledgeResynchronization();
    } finally {
      resynchronizationInFlight.current = false;
    }
  }, [acknowledgeResynchronization, onResynchronize]);

  useEffect(() => {
    if (
      needsResynchronization &&
      connectionState !== "offline" &&
      connectionState !== "unrecoverable"
    ) {
      void resynchronize().catch(() => undefined);
    }
  }, [connectionState, needsResynchronization, resynchronize]);

  const isInteractive =
    view.status !== "finished" &&
    (preview ||
      (onCommand !== undefined &&
        !commandPending &&
        connectionState === "connected"));

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <GameBoardView
        accountAction={accountAction}
        availableActions={availableActions}
        catalog={catalog}
        commandError={commandError ?? null}
        commandPending={commandPending}
        connectionState={connectionState}
        isInteractive={isInteractive}
        onCancelSupportPlay={cancelSupportPlay}
        onConfirmSupportPlay={confirmSupportPlay}
        onFinishPhase={finishPhase}
        onRetryCommand={onRetryCommand}
        onResynchronize={
          onResynchronize === undefined
            ? undefined
            : () => void resynchronize().catch(() => undefined)
        }
        pendingSupportPlay={pendingSupportPlay}
        publicEvents={publicEvents}
        view={currentView}
      />
    </DragDropProvider>
  );
}

function getConnectionState({
  isOnline,
  isResynchronizing,
  resynchronizationError,
  snapshotError,
}: {
  isOnline: boolean;
  isResynchronizing: boolean;
  resynchronizationError: unknown;
  snapshotError: unknown;
}): GameConnectionState {
  if (!isOnline) {
    return "offline";
  }
  if (isResynchronizing) {
    return "resynchronizing";
  }

  const error = resynchronizationError ?? snapshotError;
  if (isUnrecoverableSnapshotError(error)) {
    return "unrecoverable";
  }
  if (error !== null) {
    return "reconnecting";
  }
  return "connected";
}

function isUnrecoverableSnapshotError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

function GameBoardMessage({ title }: { title: string }) {
  return (
    <main className="route-message">
      <p className="route-message__eyebrow">DISASTAR CARD GAME</p>
      <h1>{title}</h1>
    </main>
  );
}

function getSnapshotErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return "この対戦を閲覧する権限がありません";
    }
    if (error.status === 404) {
      return "対戦が見つかりません";
    }
  }
  return "対戦データを取得できませんでした";
}
