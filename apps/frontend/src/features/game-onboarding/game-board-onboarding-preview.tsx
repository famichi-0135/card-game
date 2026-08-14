import { FixtureGameBoard } from "../game-board/game-board.tsx";
import { createGameBoardFixture } from "../game-board/fixtures/game-board-fixture.ts";

const ONBOARDING_PREVIEW_GAME_ID = "onboarding-preview";

export function GameBoardOnboardingPreview() {
  const fixture = createGameBoardFixture(
    ONBOARDING_PREVIEW_GAME_ID,
    "placement",
  );

  return (
    <section
      aria-label="対戦画面の操作ガイド"
      className="fixed inset-0 z-[800] overflow-auto bg-[#020609] p-4 text-[#dfe7e8]"
    >
      <div className="mx-auto grid min-w-[1180px] max-w-[1640px] gap-3">
        <header className="flex items-center justify-between gap-4 rounded border border-[#29465b] bg-[#071118] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium tracking-[.18em] text-[#5798c9]">
              GAME BOARD GUIDE
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#edf3f7]">
              対戦画面の操作を確認する
            </h2>
          </div>
          <p className="text-sm text-[#b8c6c9]">
            このガイド中に実際の対戦は開始されません
          </p>
        </header>
        <div className="h-[min(760px,calc(100vh-112px))] min-h-[620px] overflow-hidden rounded border border-[#29465b]">
          <FixtureGameBoard fixture={fixture} />
        </div>
      </div>
    </section>
  );
}
