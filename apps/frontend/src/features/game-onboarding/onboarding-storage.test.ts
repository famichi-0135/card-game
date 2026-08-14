import { afterEach, describe, expect, it } from "vitest";
import {
  GAME_BOARD_ONBOARDING_STORAGE_KEY,
  getGameBoardOnboardingState,
  saveGameBoardOnboardingState,
  shouldAutoStartGameBoardOnboarding,
} from "./onboarding-storage.ts";

const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

describe("ゲームボードオンボーディングの初回表示", () => {
  it("未保存なら自動表示の対象にする", () => {
    useStorage();

    expect(shouldAutoStartGameBoardOnboarding()).toBe(true);
  });

  it("完了またはスキップ後は自動表示しない", () => {
    const storage = useStorage();

    saveGameBoardOnboardingState("completed");
    expect(storage.getItem(GAME_BOARD_ONBOARDING_STORAGE_KEY)).toBe(
      "completed",
    );
    expect(getGameBoardOnboardingState()).toBe("completed");
    expect(shouldAutoStartGameBoardOnboarding()).toBe(false);

    storage.setItem(GAME_BOARD_ONBOARDING_STORAGE_KEY, "skipped");
    expect(getGameBoardOnboardingState()).toBe("skipped");
    expect(shouldAutoStartGameBoardOnboarding()).toBe(false);
  });

  it("localStorageが利用できなくても待機部屋を妨げない", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage unavailable");
      },
    });

    expect(getGameBoardOnboardingState()).toBeNull();
    expect(shouldAutoStartGameBoardOnboarding()).toBe(false);
    expect(() => saveGameBoardOnboardingState("skipped")).not.toThrow();
  });
});

function useStorage(): Storage {
  const entries = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
  } as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  return storage;
}
