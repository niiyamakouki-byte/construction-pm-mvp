/**
 * E2E: 票laporta-beads-fyi0b「カレンダー起点の案件登録導線」実機検証
 * 検証手法: Playwright headless Chromium + __E2E_BYPASS_AUTH__ + Google Calendar API モック
 * (実Googleアカウントへは接続しない。fetchPrimaryCalendarEvents が叩くREST v3エンドポイントを
 *  page.route でモックし、UIフロー: 予定一覧 → 案件化 → 案件詳細 の3遷移を検証する)
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { GOOGLE_PROVIDER_TOKEN_STORAGE_KEY } from "../src/contexts/AuthContext.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "calendar-inbox-verify");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const FIXED_NOW = new Date("2026-08-05T09:00:00+09:00");
const EVENT_ID = "ev-genchou-001";
const EVENT_SUMMARY = "松下様邸 現調";
const EVENT_LOCATION = "東京都世田谷区給田5-12-12";

async function mockGoogleCalendar(page: import("@playwright/test").Page) {
  await page.route("https://www.googleapis.com/calendar/v3/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: EVENT_ID,
            summary: EVENT_SUMMARY,
            location: EVENT_LOCATION,
            start: { dateTime: "2026-08-10T10:00:00+09:00" },
            end: { dateTime: "2026-08-10T11:00:00+09:00" },
          },
        ],
      }),
    });
  });
  await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ lat: "35.6440", lon: "139.6380" }]),
    });
  });
}

test.describe("カレンダー起点の案件登録導線", () => {
  test("未連携時: 空状態の1行案内が出る", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
    });
    await page.goto("/#/calendar-inbox");
    await expect(page.getByText("Googleカレンダーと連携していません")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "01-not-connected-empty-state.png"), fullPage: true });
  });

  test("連携済み・予定0件: 空でも次の一手が1行で示される", async ({ page }) => {
    await page.route("https://www.googleapis.com/calendar/v3/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });
    await page.addInitScript(
      ({ tokenKey }: { tokenKey: string }) => {
        (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
        window.sessionStorage.setItem(tokenKey, "fake-provider-token");
      },
      { tokenKey: GOOGLE_PROVIDER_TOKEN_STORAGE_KEY },
    );
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto("/#/calendar-inbox");
    await expect(page.getByText("直近30日に予定がありません")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "02-connected-zero-events.png"), fullPage: true });
  });

  test("予定 → 案件化 → 案件詳細 の一連が実際に通る(デスクトップ)", async ({ page }) => {
    await mockGoogleCalendar(page);
    await page.addInitScript(
      ({ tokenKey }: { tokenKey: string }) => {
        (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
        window.sessionStorage.setItem(tokenKey, "fake-provider-token");
        window.localStorage.removeItem("genbahub:calendar-imported-event-ids");
      },
      { tokenKey: GOOGLE_PROVIDER_TOKEN_STORAGE_KEY },
    );
    await page.clock.setFixedTime(FIXED_NOW);

    // 遷移1: 予定一覧
    await page.goto("/#/calendar-inbox");
    await expect(page.getByText(EVENT_SUMMARY)).toBeVisible();
    await expect(page.getByText(EVENT_LOCATION)).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "03-event-list.png"), fullPage: true });

    // 遷移2: 案件化ボタン→作成完了で「案件化済み・開く」に変わる
    await page.getByRole("button", { name: "この予定を案件化" }).click();
    const openButton = page.getByRole("button", { name: "案件化済み・開く" });
    await expect(openButton).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(screenshotsDir, "04-after-project-created.png"), fullPage: true });

    // 遷移3: 案件詳細へ遷移し、名前・住所が初期値として引き継がれている
    // ProjectDetailPageは lazy() の別チャンクなので、URL変化直後はまだSuspense
    // フォールバック中のことがある。ページ固有の要素(ドキュメントタブ)が
    // 出るまで待ってからスクショする(でないと旧画面を撮る競合が起きる)。
    await openButton.click();
    await expect(page).toHaveURL(/#\/project\//);
    await expect(page.getByRole("button", { name: "ドキュメント" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(EVENT_SUMMARY).first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, "05-project-detail.png"), fullPage: true });
  });

  test("スマホ幅(375px)で崩れない", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockGoogleCalendar(page);
    await page.addInitScript(
      ({ tokenKey }: { tokenKey: string }) => {
        (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
        window.sessionStorage.setItem(tokenKey, "fake-provider-token");
        window.localStorage.removeItem("genbahub:calendar-imported-event-ids");
      },
      { tokenKey: GOOGLE_PROVIDER_TOKEN_STORAGE_KEY },
    );
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto("/#/calendar-inbox");
    await expect(page.getByText(EVENT_SUMMARY)).toBeVisible();

    // 横スクロールが発生していない(=崩れていない)ことを確認
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: path.join(screenshotsDir, "06-mobile-375.png"), fullPage: true });
  });
});
