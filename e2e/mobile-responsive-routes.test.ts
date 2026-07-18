import { expect, test, type Page } from "@playwright/test";

const MOBILE_390 = { width: 390, height: 844 };

const SEED_PROJECT = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "モバイルテスト案件",
  description: "",
  status: "active",
  mode: "normal",
  startDate: "2026-07-01",
  endDate: "2026-08-31",
  includeWeekends: false,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

async function prepareAuthenticatedMobile(page: Page) {
  await page.setViewportSize(MOBILE_390);
  await page.addInitScript((project) => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
    localStorage.setItem("genbahub:projects", JSON.stringify([project]));
  }, SEED_PROJECT);
}

async function expectNoHorizontalCollapse(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    mainWidth: Math.round(document.querySelector("main")?.getBoundingClientRect().width ?? 0),
  }));

  expect(metrics.clientWidth).toBe(MOBILE_390.width);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(MOBILE_390.width);
  expect(metrics.mainWidth).toBeGreaterThanOrEqual(280);
}

test.describe("390px mobile responsive routes", () => {
  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedMobile(page);
  });

  test("/today keeps primary dashboard content readable", async ({ page }) => {
    await page.goto("/#/today");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("今日の予定").first()).toBeVisible();

    await expectNoHorizontalCollapse(page);

    const firstDashboardCard = page.getByRole("button", { name: /今日の予定/ }).first();
    const box = await firstDashboardCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(280);

    const greetingCard = page.locator("p.font-bold.text-brand-800").first().locator("..");
    await expect(greetingCard).not.toContainText("光輝さん");
    const greetingBox = await greetingCard.boundingBox();
    expect(greetingBox).not.toBeNull();
    expect(greetingBox?.width).toBeGreaterThanOrEqual(280);
  });

  test("/estimate keeps form and catalog content readable", async ({ page }) => {
    await page.goto("/#/estimate");
    await page.waitForLoadState("networkidle");
    // EstimatePage shows a mode selector first; click "品目追加" (112ac4fで「手動で作成」から改名) to enter the form
    const modeCard = page.getByRole("button", { name: "品目追加" });
    const modeBox = await modeCard.boundingBox();
    expect(modeBox).not.toBeNull();
    expect(modeBox?.width).toBeGreaterThanOrEqual(280);
    await modeCard.click();
    await expect(page.getByRole("heading", { name: "品目から手動で作成" })).toBeVisible();

    await expectNoHorizontalCollapse(page);

    const propertyInput = page.getByLabel(/物件名/);
    const inputBox = await propertyInput.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(inputBox?.width).toBeGreaterThanOrEqual(280);

    const catalogButton = page.getByRole("button", { name: /解体・撤去/ });
    const catalogBox = await catalogButton.boundingBox();
    expect(catalogBox).not.toBeNull();
    expect(catalogBox?.width).toBeGreaterThanOrEqual(280);
  });

  for (const route of ["/app", "/gantt", "/schedule", "/weather", "/progress-review"]) {
    test(`${route} does not reintroduce the shared 725px mobile width`, async ({ page }) => {
      await page.goto(`/#${route}`);
      await page.waitForLoadState("networkidle");

      await expectNoHorizontalCollapse(page);
    });
  }
});
