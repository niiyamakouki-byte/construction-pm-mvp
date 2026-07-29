/**
 * Verification for laporta-beads-ld4ms: GreetingHeader used to hardcode
 * "晴れ" (fixed weather text) with no indication it was a stub. This test
 * confirms the fake weather text is gone from /today while the greeting
 * and date still render correctly, across 3 viewport widths.
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "screenshots", "ld4ms-weather-removal-verify");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const SEED_PROJECTS = [
  {
    id: "4b9e1234-5678-4abc-bdef-000000000001",
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

const SEED_CONTRACTORS = [
  {
    id: "0a3969bb-bc5c-4b47-afe6-09d7447894dd",
    name: "株式会社ラポルタ",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

const SEED_TASKS = [
  {
    id: "17275fb3-4d06-474b-8974-1839d47698e3",
    projectId: "4b9e1234-5678-4abc-bdef-000000000001",
    name: "塗装下地調整",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-08",
    progress: 50,
    dependencies: [],
    contractorId: "0a3969bb-bc5c-4b47-afe6-09d7447894dd",
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

async function seedLocalStorage(page: Page) {
  await page.addInitScript(
    ({ projects, tasks, contractors }) => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
      localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
      localStorage.setItem("genbahub:last-project-id", "4b9e1234-5678-4abc-bdef-000000000001");
    },
    { projects: SEED_PROJECTS, tasks: SEED_TASKS, contractors: SEED_CONTRACTORS },
  );
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 1400 },
];

for (const vp of VIEWPORTS) {
  test(`/today (${vp.name}) shows no fake "晴れ" weather stub`, async ({ page }) => {
    await seedLocalStorage(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:5173/#/today");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(outDir, `today-${vp.name}.png`), fullPage: true });

    // The greeting header card ("今日の現場") must not contain the old
    // hardcoded weather text.
    const headerText = await page.evaluate(() => {
      const eyebrow = Array.from(document.querySelectorAll("p")).find(
        (p) => p.textContent?.trim() === "今日の現場",
      );
      return eyebrow?.parentElement?.textContent ?? "";
    });
    expect(headerText).not.toContain("晴れ");

    // Greeting + date must still render (surgical change only removed weather).
    await expect(page.getByText(/おはようございます|お疲れ様です|お疲れ様でした|夜遅くまでお疲れ様です/)).toBeVisible();
    await expect(page.getByText(/\d{4}年\d{1,2}月\d{1,2}日/)).toBeVisible();
  });
}
