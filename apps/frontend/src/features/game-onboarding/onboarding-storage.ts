export const GAME_BOARD_ONBOARDING_STORAGE_KEY =
  "disastar:onboarding:game-board:v1";

export type GameBoardOnboardingState = "completed" | "skipped";

export function getGameBoardOnboardingState(): GameBoardOnboardingState | null {
  const value = getStorage()?.getItem(GAME_BOARD_ONBOARDING_STORAGE_KEY);
  return value === "completed" || value === "skipped" ? value : null;
}

export function shouldAutoStartGameBoardOnboarding(): boolean {
  const storage = getStorage();
  return (
    storage !== null &&
    storage.getItem(GAME_BOARD_ONBOARDING_STORAGE_KEY) === null
  );
}

export function saveGameBoardOnboardingState(
  state: GameBoardOnboardingState,
): void {
  try {
    getStorage()?.setItem(GAME_BOARD_ONBOARDING_STORAGE_KEY, state);
  } catch {
    // 保存できない環境でも待機部屋の利用は継続できる。
  }
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
