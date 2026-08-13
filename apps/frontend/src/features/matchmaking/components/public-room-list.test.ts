import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicRoomList } from "./public-room-list.tsx";

describe("公開部屋一覧", () => {
  it("トップ画面で参加可能な部屋と操作導線を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(PublicRoomList, {
        error: null,
        isLoading: false,
        matches: [
          {
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60_000,
            isOwner: false,
            matchId: "match-public-1",
            ownerFaction: "disaster",
          },
        ],
        onRefresh: vi.fn(),
        onSelect: vi.fn(),
      }),
    );

    expect(html).toContain("募集中の対戦部屋");
    expect(html).toContain("災害側が募集中");
    expect(html).toContain("部屋を開く");
    expect(html).toContain("更新");
    expect(html).not.toContain("match-public-1");
  });
});
