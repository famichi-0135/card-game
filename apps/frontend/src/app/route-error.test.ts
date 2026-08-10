import { describe, expect, it } from "vitest";
import { getRouteErrorDescription } from "./route-error.ts";

describe("getRouteErrorDescription", () => {
  it("不足しているルートパラメーターは利用者向けの説明を維持する", () => {
    expect(
      getRouteErrorDescription(new Error("ゲームIDが指定されていません。")),
    ).toBe("ゲームIDが指定されていません。");
  });

  it("チャンク取得失敗の内部情報を画面へ出さない", () => {
    const description = getRouteErrorDescription(
      new Error(
        "Failed to fetch dynamically imported module: https://example.test/assets/private.js",
      ),
    );

    expect(description).toBe(
      "ページを読み込めませんでした。通信状態を確認して、もう一度お試しください。",
    );
    expect(description).not.toContain("private.js");
  });
});
