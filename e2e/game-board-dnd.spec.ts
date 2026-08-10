import { expect, test } from "@playwright/test";

test.describe("ゲーム盤面のドラッグ操作", () => {
  test("手札の攻撃カードを空き攻撃グループへドラッグして配置できる", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/games/demo?scenario=placement");

    const card = page.getByRole("button", {
      name: /河川の氾濫。攻撃操作の候補があります/,
    });
    const target = page.getByRole("button", {
      name: "攻撃グループ枠 1。カードを選択してから操作",
    });

    await expect(card).toBeVisible();
    await expect(target).toBeVisible();
    await card.dragTo(target);

    await expect(page.getByLabel("自分の攻撃グループ")).toContainText(
      "河川の氾濫",
    );
  });

  test("フェーズ期限を過ぎると状態更新がなくても手札の操作候補を無効化する", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
    await page.goto("/games/demo?scenario=placement");

    const card = page.getByRole("button", {
      name: /河川の氾濫。攻撃操作の候補があります/,
    });
    await expect(card).toBeVisible();

    await page.clock.fastForward(78_001);

    await expect(
      page.getByRole("button", {
        name: /河川の氾濫。このフェーズでは操作できません/,
      }),
    ).toBeVisible();
  });
});
