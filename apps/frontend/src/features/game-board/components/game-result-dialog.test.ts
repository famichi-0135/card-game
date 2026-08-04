import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { createGameBoardFixture } from "../fixtures/game-board-fixture.ts";
import { GameResultDialog } from "./game-result-dialog.tsx";

describe("対戦中止の結果表示", () => {
  it("中止したプレイヤーには敗北と本人による中止を表示する", () => {
    const fixture = createGameBoardFixture("forfeit-result", "finished");
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(GameResultDialog, {
          view: {
            ...fixture.view,
            winner: {
              type: "player",
              playerId: fixture.view.opponent.playerId,
              reason: "forfeit",
            },
          },
        }),
      ),
    );

    expect(markup).toContain("敗北");
    expect(markup).toContain("あなたが対戦を中止しました。");
  });

  it("対戦相手には勝利と相手による中止を表示する", () => {
    const fixture = createGameBoardFixture(
      "opponent-forfeit-result",
      "finished",
    );
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(GameResultDialog, {
          view: {
            ...fixture.view,
            winner: {
              type: "player",
              playerId: fixture.view.viewerPlayerId,
              reason: "forfeit",
            },
          },
        }),
      ),
    );

    expect(markup).toContain("勝利");
    expect(markup).toContain("相手が対戦を中止しました。");
  });
});
