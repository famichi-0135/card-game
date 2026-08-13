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
    const cardBox = await card.boundingBox();
    const targetBox = await target.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (cardBox === null || targetBox === null) {
      throw new Error("ドラッグ元または配置先の座標を取得できませんでした。");
    }
    await page.mouse.move(
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();

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

  test("キーボードで選択した攻撃カードの合法な配置先と連鎖先だけを強調する", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/games/demo?scenario=placement");

    const card = page.getByRole("button", {
      name: /直下型地震。攻撃操作の候補があります/,
    });
    await card.press("Enter");

    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-selected-card-target="place"]'),
    ).toHaveCount(4);
    await expect(
      page.locator('[data-selected-card-target="chain"]'),
    ).toHaveCount(1);
  });

  test("クリックで選択した攻撃カードの合法な配置先と連鎖先だけを強調する", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/games/demo?scenario=placement");

    const card = page.getByRole("button", {
      name: /直下型地震。攻撃操作の候補があります/,
    });
    await card.click();

    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-selected-card-target="place"]'),
    ).toHaveCount(4);
    await expect(
      page.locator('[data-selected-card-target="chain"]'),
    ).toHaveCount(1);
  });
});
