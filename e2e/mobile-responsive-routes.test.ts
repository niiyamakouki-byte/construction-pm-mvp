import { expect, test, type Page } from "@playwright/test";

const MOBILE_390 = { width: 390, height: 844 };

async function prepareAuthenticatedMobile(page: Page) {
  await page.setViewportSize(MOBILE_390);
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
  });
}

async function expectNoHorizontalCollapse(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(metrics.clientWidth).toBe(MOBILE_390.width);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(MOBILE_390.width);
}

test.describe("390px mobile responsive routes", () => {
  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedMobile(page);
  });

  test("/today keeps primary dashboard content readable", async ({ page }) => {
    await page.goto("/#/today");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("今日の予定")).toBeVisible();

    await expectNoHorizontalCollapse(page);

    const firstDashboardCard = page.getByRole("button", { name: /今日の予定/ }).first();
    const box = await firstDashboardCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(280);
  });

  test("/estimate keeps form and catalog content readable", async ({ page }) => {
    await page.goto("/#/estimate");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "見積作成" })).toBeVisible();

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
});
