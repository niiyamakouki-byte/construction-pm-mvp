import { test, expect } from "@playwright/test";

// laporta-beads-77qyl: 未ログイン + 初回訪問で / を開くと、/app→/login のバウンスを経由せず
// 直接LandingPage(価値訴求+主CTA=新規登録)が表示されることを固定する。

test.describe("laporta-beads-77qyl: 未ログイン / 訪問でLPを直接表示", () => {
  test("390px: LPのhero+主CTAがファーストビュー内、横オーバーフローなし、/loginへバウンスしない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // /login フォームへバウンスせず、LPが直接表示される
    await expect(page.locator("#email")).not.toBeVisible();
    await expect(page.locator("h1")).toContainText("現場の面倒が");

    const cta = page.getByRole("button", { name: "14日間 無料で始める" });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });

  test("1440px: LPのhero+主CTAがファーストビュー内、横オーバーフローなし", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#email")).not.toBeVisible();
    await expect(page.locator("h1")).toContainText("現場の面倒が");

    const cta = page.getByRole("button", { name: "14日間 無料で始める" });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });

  test("既存ユーザーのログイン導線は失われない（LPのログインリンク→/login）", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator("nav").getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole("heading", { name: "ログイン", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  });
});
