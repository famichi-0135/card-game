import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartingMatchRecoveryActions } from "./match-room.tsx";

describe("StartingMatchRecoveryActions", () => {
  it("参加者には同じ開始処理を再試行する操作を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(StartingMatchRecoveryActions, {
        isPending: false,
        onAction: () => {},
        role: "opponent",
      }),
    );

    expect(html).toContain("対戦開始を再試行する");
  });

  it("作成者には開始中の部屋を取り消す操作を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(StartingMatchRecoveryActions, {
        isPending: false,
        onAction: () => {},
        role: "owner",
      }),
    );

    expect(html).toContain("招待部屋を取り消す");
    expect(html).not.toContain("対戦開始を再試行する");
  });
});
