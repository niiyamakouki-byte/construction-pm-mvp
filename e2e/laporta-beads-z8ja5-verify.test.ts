import { expect, test, type Page } from "@playwright/test";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

// laporta-beads-z8ja5: 390px幅の初回サンプル工程表で、工程追加FABが検索件数/フィルタと重ならないことを固定する。
// 対策: ヘッダー内「+工程追加」ボタンが画面内にある間はFABを隠し、スクロールアウトした時だけ表示する。

const SEED_PROJECT = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "渋谷オフィスビル内装工事（サンプル）",
  description: "",
  status: "active",
  mode: "normal",
  startDate: "2026-08-03",
  endDate: "2026-09-02",
  includeWeekends: false,
  createdAt: "2026-08-03T00:00:00Z",
  updatedAt: "2026-08-03T00:00:00Z",
};

async function seedProject(page: Page) {
  await bypassAuthWithSeed(page, {
    genbahub_onboarding_done: "1",
    genbahub_tour_done: "1",
    "genbahub:projects": [SEED_PROJECT],
  });
}

test.describe("laporta-beads-z8ja5: 工程追加FABが検索件数/フィルタと重ならない", () => {
  test("390px 初期表示: ヘッダーCTAが見える間はFABが非表示、スクロールアウト後は44px以上を維持して表示", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedProject(page);

    await page.goto(`/#/gantt/${SEED_PROJECT.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/件が条件に一致/)).toBeVisible();

    const fab = page.getByRole("button", { name: "新しいタスクを追加" });
    // 初期表示ではヘッダーの「+工程追加」ボタンが画面内にあるためFABは非表示 = 検索件数/フィルタと重ならない
    await expect(fab).toBeHidden();

    await page.mouse.wheel(0, 800);
    await expect(fab).toBeVisible({ timeout: 5000 });
    const fabBox = await fab.boundingBox();
    expect(fabBox).not.toBeNull();
    expect(fabBox!.width).toBeGreaterThanOrEqual(44);
    expect(fabBox!.height).toBeGreaterThanOrEqual(44);
    expect(fabBox!.x + fabBox!.width).toBeLessThanOrEqual(390);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });

  test("1440px: 横オーバーフローなし", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedProject(page);

    await page.goto(`/#/gantt/${SEED_PROJECT.id}`);
    await page.waitForLoadState("networkidle");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });
});
