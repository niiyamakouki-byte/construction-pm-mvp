/**
 * E2E: 票laporta-beads-4o9m2「依存線の紫をセージ規範色へ+遅延の柄表現」実機検証
 * 検証手法: Playwright headless Chromium + __E2E_BYPASS_AUTH__ + localStorage デモシード
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "4o9m2-verify");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PID = "44444444-4444-4444-4444-444444444444";

const SEED_PROJECTS = [
  {
    id: PID,
    name: "4o9m2検証デモ案件",
    description: "依存線セージ規範色+遅延ハッチング E2E検証用",
    status: "active",
    mode: "normal",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    includeWeekends: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

const SEED_TASKS = [
  {
    id: "ee000001-0000-0000-0000-000000000001",
    projectId: PID,
    name: "解体作業",
    description: "",
    status: "done",
    startDate: "2026-07-01",
    dueDate: "2026-07-05",
    progress: 100,
    dependencies: [],
    majorCategory: "解体工事",
    canvasX: 80,
    canvasY: 80,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "ee000002-0000-0000-0000-000000000002",
    projectId: PID,
    name: "電気配線工事",
    description: "",
    status: "in_progress",
    startDate: "2026-07-06",
    // 今日(サーバ側テスト実行日)より前を締切にして必ず期限切=ハッチング表示になるよう固定日付にする
    dueDate: "2026-07-10",
    progress: 50,
    dependencies: ["ee000001-0000-0000-0000-000000000001"],
    majorCategory: "電気工事",
    canvasX: 320,
    canvasY: 240,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

test("ガントの依存線に旧紫は無く、遅延タスクに斜線ハッチングが表示される", async ({ page }) => {
  await bypassAuthWithSeed(page, {
    "genbahub:projects": SEED_PROJECTS,
    "genbahub:tasks": SEED_TASKS,
    "genbahub:contractors": [],
    "genbahub:last-project-id": PID,
  });
  await page.goto("/#/gantt");

  // ガント側の依存線(DependencyArrows.tsx)はFS/FF/SS/SF別に色分けされており、
  // #7c3aedの旧紫は元々使われていない(dead codeのDependencyLines.tsxのみが#7c3aedを持っていた)。
  // ここでは規範色汚染が無いことと、遅延ハッチングの表示を確認する。
  const depArrow = page.getByTestId(
    "dep-arrow-ee000001-0000-0000-0000-000000000001-ee000002-0000-0000-0000-000000000002",
  );
  await expect(depArrow).toBeVisible();
  const pageHtml = await page.content();
  expect(pageHtml).not.toContain("#7c3aed");

  const hatch = page.getByTestId("overdue-hatch");
  await expect(hatch).toBeVisible();
  const bgImage = await hatch.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bgImage).toContain("repeating-linear-gradient");

  await page.screenshot({ path: path.join(screenshotsDir, "01-gantt-sage-dep-line-and-hatch.png"), fullPage: true });
});

test("カードボードの依存線も旧紫(#7c3aed)ではなくセージグリーン規範色(#346538)で描画される", async ({ page }) => {
  await bypassAuthWithSeed(page, {
    "genbahub:projects": SEED_PROJECTS,
    "genbahub:tasks": SEED_TASKS,
    "genbahub:contractors": [],
    "genbahub:last-project-id": PID,
  });
  await page.goto(`/#/cards/${PID}`);

  const depLine = page.locator('svg path[stroke="#346538"]').first();
  await expect(depLine).toBeVisible();

  const pageHtml = await page.content();
  expect(pageHtml).not.toContain("#7c3aed");

  await page.screenshot({ path: path.join(screenshotsDir, "02-cardboard-sage-dep-line.png"), fullPage: true });
});
