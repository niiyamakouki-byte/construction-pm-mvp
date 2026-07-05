/**
 * E2E: GenbaHub 修正確認テスト (2026-07-04)
 * 修正①: SafetyInspectionPage タブバー右フェード
 * 修正②: FinishingSchedulePage プロジェクト名 localStorage 解決
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "genbahub-fix-0704");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PID = "4b9e1234-5678-4abc-bdef-000000000001";

const SEED_PROJECTS = [
  {
    id: PID,
    name: "GenbaHubデモ案件",
    description: "E2E検証用デモプロジェクト",
    status: "active",
    mode: "normal",
    startDate: "2026-06-28",
    endDate: "2026-08-31",
    includeWeekends: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

async function seedLocalStorage(page: Page) {
  await page.addInitScript(
    ({ projects, pid }) => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:last-project-id", pid);
    },
    { projects: SEED_PROJECTS, pid: PID },
  );
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: true,
  });
}

test.describe("GenbaHub 修正確認", () => {
  // ── 修正①: SafetyInspectionPage 右フェード ──────────────────────────────────
  test("fix1_safety_tab_fade — 390px幅でフェード要素が存在する", async ({ page }) => {
    await seedLocalStorage(page);
    await page.goto("http://localhost:5173/#/safety");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // デスクトップSS (before)
    await screenshot(page, "safety-desktop-before.png");

    // 390px幅に変更
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // フェード要素が存在すること
    const fade = page.locator("[data-testid='tab-scroll-fade']");
    await expect(fade).toBeAttached();

    // スクロールコンテナが存在すること
    const scrollContainer = page.locator("[data-testid='safety-tab-scroll']");
    await expect(scrollContainer).toBeVisible();

    // モバイルSS (after — フェード確認用)
    await screenshot(page, "safety-mobile-fade-after.png");

    // "書類" タブが DOM 内に存在すること（スクロール先）
    const docTab = page.locator("button").filter({ hasText: "書類" });
    await expect(docTab).toBeAttached();

    // スクロールしてタブが表示されること
    await docTab.scrollIntoViewIfNeeded();
    await expect(docTab).toBeVisible();
    await screenshot(page, "safety-mobile-scrolled-after.png");
  });

  // ── 修正②: FinishingSchedulePage プロジェクト名解決 ────────────────────────
  test("fix2_finishing_project_name — lastProjectIdから案件名を表示", async ({ page }) => {
    await seedLocalStorage(page);
    await page.goto("http://localhost:5173/#/finishing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // デスクトップSS
    await screenshot(page, "finishing-desktop-before.png");

    // "施工案件" (固定フォールバック) が表示されていないこと
    const bodyText = await page.locator("body").innerText();
    expect(
      bodyText,
      '「施工案件」固定文字列が表示されている (localStorage解決失敗)',
    ).not.toContain("施工案件");

    // 実際のプロジェクト名が表示されていること
    await expect(
      page.locator("text=GenbaHubデモ案件").first(),
    ).toBeVisible({ timeout: 5000 });

    // デスクトップSS (after)
    await screenshot(page, "finishing-desktop-after.png");

    // モバイルSS
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshot(page, "finishing-mobile-after.png");
  });

  // ── フォールバック確認: lastProjectId なし → "施工案件" 表示 ─────────────────
  test("fix2_finishing_fallback — lastProjectIdなしは施工案件フォールバック", async ({ page }) => {
    // lastProjectId を設定しない (最小seed)
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.removeItem("genbahub:last-project-id");
      localStorage.removeItem("genbahub:projects");
    });
    await page.goto("http://localhost:5173/#/finishing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // フォールバックテキスト確認
    await expect(page.locator("text=施工案件").first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "finishing-fallback.png");
  });
});
