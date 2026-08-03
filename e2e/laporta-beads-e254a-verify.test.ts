import { test, expect, type Page } from "@playwright/test";

// laporta-beads-e254a: 新規ストレージでdev専用E2Eバイパスを有効化し /app へ進むと
// サンプル案件の自動bootstrap成功後にTourGuideが開始されることを固定する。
// (旧: markOnboardingDone + navigate のみでsetShowTour(true)が無く、次の一手が示されなかった)

async function bypassAuthFreshStorage(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
}

test.describe("laporta-beads-e254a: 自動bootstrap成功後にツアーガイドを開始する", () => {
  test("390px: サンプル工程表着地後にツアーガイドが表示され、スキップ後も操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bypassAuthFreshStorage(page);

    await page.goto("/#/app");
    await page.waitForURL(/#\/gantt\//, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const dialog = page.getByRole("dialog", { name: /ツアーガイド/ });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0);

    await dialog.getByText("スキップ", { exact: true }).click();
    await expect(dialog).not.toBeVisible();

    // ガイド終了後もサンプル工程表を操作できる(検索欄が有効)
    await expect(page.getByRole("searchbox", { name: "工程検索" })).toBeEnabled();
  });

  test("1440px: サンプル工程表着地後にツアーガイドが表示される", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bypassAuthFreshStorage(page);

    await page.goto("/#/app");
    await page.waitForURL(/#\/gantt\//, { timeout: 15000 });

    const dialog = page.getByRole("dialog", { name: /ツアーガイド/ });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  });
});
