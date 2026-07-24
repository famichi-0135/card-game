import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FixtureGameBoard } from "./game-board.tsx";
import { createGameBoardFixture } from "./fixtures/game-board-fixture.ts";

describe("ゲームボードのデスクトップレイアウト", () => {
  it("進行バー、3列の盤面、下部の操作・手札エリアへ既存の操作を配置する", () => {
    const fixture = createGameBoardFixture("layout-test");
    const markup = renderToStaticMarkup(
      createElement(FixtureGameBoard, { fixture }),
    );

    expect(markup).toContain('data-board-region="game-progress"');
    expect(markup).toContain('data-board-region="player-status"');
    expect(markup).toContain('data-board-region="card-field"');
    expect(markup).toContain('data-board-region="resources"');
    expect(markup).toContain('data-board-region="player-actions"');
    expect(markup).toContain('aria-label="自分の捨て札"');
    expect(markup).toContain('aria-label="相手の捨て札"');
    expect(markup).toContain('aria-label="自分のサポートゾーン"');
    expect(markup).toContain('aria-label="自分の手札"');
    expect(markup).toContain(
      'aria-label="自分の手札" class="min-w-0 overflow-visible"',
    );
    expect(markup).toContain('aria-label="自分の山札"');
    const statusStart = markup.indexOf('data-board-region="player-status"');
    const fieldStart = markup.indexOf('data-board-region="card-field"');
    const playerStatusMarkup = markup.slice(statusStart, fieldStart);
    expect(playerStatusMarkup).not.toContain("捨て札");

    expect(markup.indexOf('data-board-region="game-progress"')).toBeLessThan(
      markup.indexOf('data-board-region="card-field"'),
    );
    expect(markup.indexOf('data-board-region="card-field"')).toBeLessThan(
      markup.indexOf('data-board-region="player-actions"'),
    );
  });
});
