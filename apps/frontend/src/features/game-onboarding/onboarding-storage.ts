export const GAME_BOARD_ONBOARDING_STORAGE_KEY =
  "disastar:onboarding:game-board:v1";

export type GameBoardOnboardingState = "completed" | "skipped";

export function getGameBoardOnboardingState(): GameBoardOnboardingState | null {
  try {
    const value = getStorage()?.getItem(GAME_BOARD_ONBOARDING_STORAGE_KEY);
    return value === "completed" || value === "skipped" ? value : null;
  } catch {
    return null;
  }
}

export function shouldAutoStartGameBoardOnboarding(): boolean {
  try {
    const storage = getStorage();
    if (storage === null) {
      return false;
    }
    return storage.getItem(GAME_BOARD_ONBOARDING_STORAGE_KEY) === null;
  } catch {
    return false;
  }
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
