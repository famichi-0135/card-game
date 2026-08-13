import { describe, expect, it, vi } from "vitest";

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }));

vi.mock("../../../components/ui/toast.tsx", () => ({
  toast: { add: toastAdd },
}));

import { notifyMatchmakingError } from "./error-notifications.ts";

describe("対戦準備のエラー通知", () => {
  it("画面本文へエラーを追加せず、トーストとして通知する", () => {
    notifyMatchmakingError({
      description: "招待 URL を確認してください。",
      title: "参加できません",
    });

    expect(toastAdd).toHaveBeenCalledWith({
      description: "招待 URL を確認してください。",
      title: "参加できません",
      type: "error",
    });
  });
});
