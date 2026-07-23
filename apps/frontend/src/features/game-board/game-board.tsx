import { DragDropProvider } from "@dnd-kit/react";
import type { GameCommand } from "@disastar/game-engine";
import { GameBoardView } from "./game-board-view.tsx";
import type { GameBoardFixture } from "./fixtures/game-board-fixture.ts";
import { useGameBoardActions } from "./hooks/use-game-board-actions.ts";

export function GameBoard({
  fixture,
  onCommand,
}: {
  fixture: GameBoardFixture;
  onCommand?: (command: GameCommand) => void;
}) {
  const { catalog, view } = fixture;
  const { availableActions, currentView, finishPhase, handleDragEnd } =
    useGameBoardActions({ catalog, onCommand, view });

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <GameBoardView
        availableActions={availableActions}
        catalog={catalog}
        onFinishPhase={finishPhase}
        view={currentView}
      />
    </DragDropProvider>
  );
}
