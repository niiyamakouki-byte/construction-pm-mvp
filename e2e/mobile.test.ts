import { test, expect } from "@playwright/test";

const IPHONE_14 = { width: 390, height: 844 };

test.describe("iPhone 14 モバイルビュー", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(IPHONE_14);
  });

  test("トップページがモバイルで表示される", async ({ page }) => {
    await page.goto("/#/app");
    await expect(page.locator("text=GenbaHub")).toBeVisible();
  });

  test("ログインページがモバイルで表示される", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("入退場キオスク（SiteEntryPage）のIN/OUTボタンが表示される", async ({ page }) => {
    // SiteEntryPage は /entry/:projectId で認証不要
    await page.goto("/#/entry/test-project");

    // IN ボタン
    const inButton = page.locator("button", { hasText: "IN" });
    await expect(inButton).toBeVisible();

    // OUT ボタン
    const outButton = page.locator("button", { hasText: "OUT" });
    await expect(outButton).toBeVisible();

    // IN/OUTボタンがページ内に存在する（中央配置はレイアウト上の確認）
    const inBox = await inButton.boundingBox();
    const outBox = await outButton.boundingBox();
    expect(inBox).not.toBeNull();
    expect(outBox).not.toBeNull();

    if (inBox && outBox) {
      // 両ボタンがビューポート幅の中央付近にある（左端 < ビューポート中心 < 右端）
      const viewportCenter = IPHONE_14.width / 2;
      expect(inBox.x).toBeLessThan(viewportCenter);
      expect(inBox.x + inBox.width).toBeGreaterThan(viewportCenter);
      expect(outBox.x).toBeLessThan(viewportCenter);
      expect(outBox.x + outBox.width).toBeGreaterThan(viewportCenter);
    }
  });

  test("ナビゲーションがモバイルで崩れていない", async ({ page }) => {
    await page.goto("/#/app");

    // ボトムナビ（md:hidden なのでモバイルのみ表示）
    const bottomNav = page.locator("nav[aria-label='ボトムナビゲーション']");
    await expect(bottomNav).toBeVisible();

    // デスクトップ用ナビは非表示
    const desktopNav = page.locator("nav[aria-label='メインナビゲーション']");
    await expect(desktopNav).toBeHidden();

    // ボトムナビ内のタブが4つある
    const tabs = bottomNav.locator("button");
    await expect(tabs).toHaveCount(4);
  });
});
