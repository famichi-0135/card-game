import { DragDropProvider } from "@dnd-kit/react";
import type {
  GameCommand,
  PlayerGameView,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { ApiClientError } from "../../app/api-client.ts";
import { GameBoardView } from "./game-board-view.tsx";
import type { GameBoardFixture } from "./fixtures/game-board-fixture.ts";
import {
  useGameSnapshot,
  usePublicCardCatalog,
} from "./hooks/use-game-board-data.ts";
import { useGameBoardActions } from "./hooks/use-game-board-actions.ts";

export function FixtureGameBoard({ fixture }: { fixture: GameBoardFixture }) {
  return (
    <GameBoardContent catalog={fixture.catalog} preview view={fixture.view} />
  );
}

export function GameBoard({ gameId }: { gameId: string }) {
  const snapshot = useGameSnapshot(gameId);
  const catalog = usePublicCardCatalog(snapshot.data?.view.cardCatalogVersion);

  if (snapshot.isPending) {
    return <GameBoardMessage title="対戦データを読み込んでいます" />;
  }
  if (snapshot.isError) {
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
      view={snapshot.data.view}
    />
  );
}

function GameBoardContent({
  catalog,
  onCommand,
  preview = false,
  view,
}: {
  catalog: PublicCardCatalog;
  onCommand?: (command: GameCommand) => void;
  preview?: boolean;
  view: PlayerGameView;
}) {
  const {
    availableActions,
    cancelSupportPlay,
    confirmSupportPlay,
    currentView,
    finishPhase,
    handleDragEnd,
    pendingSupportPlay,
  } = useGameBoardActions({ catalog, onCommand, preview, view });
  const isInteractive = preview || onCommand !== undefined;

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <GameBoardView
        availableActions={availableActions}
        catalog={catalog}
        isInteractive={isInteractive}
        onCancelSupportPlay={cancelSupportPlay}
        onConfirmSupportPlay={confirmSupportPlay}
        onFinishPhase={finishPhase}
        pendingSupportPlay={pendingSupportPlay}
        view={currentView}
      />
    </DragDropProvider>
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
