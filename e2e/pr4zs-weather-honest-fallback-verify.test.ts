/**
 * bead laporta-beads-pr4zs: WeatherPage が座標未設定 / Open-Meteo API失敗時に
 * 合成データ(createMockForecast)を実予報として無警告表示しないことを実機検証する。
 * 375px(スマホ幅)でレイアウトが崩れないことも合わせて確認する。
 */
import { expect, test, type Page } from "@playwright/test";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const MOBILE_375 = { width: 375, height: 812 };

const PROJECT_NO_LOCATION = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "住所未設定案件",
  description: "",
  status: "active",
  mode: "normal",
  startDate: "2026-08-01",
  includeWeekends: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const PROJECT_WITH_LOCATION = {
  ...PROJECT_NO_LOCATION,
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "座標設定済み案件",
  latitude: 35.68,
  longitude: 139.76,
};

async function seedAndGoToWeather(page: Page, project: Record<string, unknown>) {
  await page.setViewportSize(MOBILE_375);
  await bypassAuthWithSeed(page, {
    genbahub_onboarding_done: "1",
    genbahub_tour_done: "1",
    "genbahub:projects": [project],
  });
  await page.goto("/#/weather");
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.clientWidth).toBe(MOBILE_375.width);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(MOBILE_375.width);
}

test.describe("WeatherPage honest-fallback (375px)", () => {
  test("no coordinates: shows honest unavailable message, no fake 施工影響/延期推奨 cards", async ({ page }) => {
    await seedAndGoToWeather(page, PROJECT_NO_LOCATION);

    await expect(page.getByText(/の天候情報を取得できません/)).toBeVisible();
    await expect(page.getByText(/住所（緯度・経度）が未設定です/)).toBeVisible();
    await expect(page.getByText("施工影響")).toHaveCount(0);
    await expect(page.getByText("延期推奨").first()).not.toBeVisible().catch(() => {});
    expect(await page.getByText("延期推奨").count()).toBe(0);

    await expectNoHorizontalOverflow(page);
  });

  test("Open-Meteo API failure: shows honest unavailable message, no fake forecast", async ({ page }) => {
    await page.route("https://api.open-meteo.com/**", async (route) => {
      await route.fulfill({ status: 500, body: "boom" });
    });

    await seedAndGoToWeather(page, PROJECT_WITH_LOCATION);

    await expect(page.getByText(/の天候情報を取得できません/)).toBeVisible();
    await expect(page.getByText(/取得に失敗しました/)).toBeVisible();
    expect(await page.getByText("施工影響").count()).toBe(0);
    expect(await page.getByText("延期推奨").count()).toBe(0);

    await expectNoHorizontalOverflow(page);
  });

  test("Open-Meteo API success: shows real forecast cards, no unavailable message", async ({ page }) => {
    await page.route("https://api.open-meteo.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          daily: {
            time: Array.from({ length: 7 }, (_, i) => `2026-08-${String(6 + i).padStart(2, "0")}`),
            weather_code: [3, 3, 3, 3, 3, 3, 3],
            temperature_2m_max: [29, 29, 29, 29, 29, 29, 29],
            temperature_2m_min: [23, 23, 23, 23, 23, 23, 23],
            precipitation_probability_max: [10, 10, 10, 10, 10, 10, 10],
            wind_speed_10m_max: [5, 5, 5, 5, 5, 5, 5],
          },
        }),
      });
    });

    await seedAndGoToWeather(page, PROJECT_WITH_LOCATION);

    await expect(page.getByText("施工影響").first()).toBeVisible();
    await expect(page.getByText(/の天候情報を取得できません/)).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});
