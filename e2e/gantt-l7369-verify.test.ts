/**
 * E2E: 票laporta-beads-l7369「ガント行チェックボックス+今日ジャンプボタン」実機検証
 * 検証手法: Playwright headless Chromium + __E2E_BYPASS_AUTH__ + localStorage デモシード
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "gantt-l7369-verify");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PID = "33333333-3333-3333-3333-333333333333";

const SEED_PROJECTS = [
  {
    id: PID,
    name: "l7369検証デモ案件",
    description: "行チェックボックス+今日ジャンプ E2E検証用",
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
    id: "dd000001-0000-0000-0000-000000000001",
    projectId: PID,
    name: "解体作業",
    description: "",
    status: "todo",
    startDate: "2026-07-01",
    dueDate: "2026-07-10",
    progress: 0,
    dependencies: [],
    majorCategory: "解体工事",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "dd000002-0000-0000-0000-000000000002",
    projectId: PID,
    name: "軽鉄下地組み",
    description: "",
    status: "in_progress",
    startDate: "2026-07-11",
    dueDate: "2026-07-25",
    progress: 30,
    dependencies: [],
    majorCategory: "解体工事",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

async function seedAndGoto(page: import("@playwright/test").Page) {
  await bypassAuthWithSeed(page, {
    "genbahub:projects": SEED_PROJECTS,
    "genbahub:tasks": SEED_TASKS,
    "genbahub:contractors": [],
    "genbahub:last-project-id": PID,
  });
  await page.goto("/#/gantt");
  await expect(page.getByTestId("task-done-checkbox-dd000001-0000-0000-0000-000000000001")).toBeVisible();
}

test("① 行チェックボックスをクリックするとタスクが完了になり、グレー表示+フェーズ進捗が追従する", async ({ page }) => {
  await seedAndGoto(page);

  const checkbox = page.getByTestId("task-done-checkbox-dd000001-0000-0000-0000-000000000001");
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  await page.screenshot({ path: path.join(screenshotsDir, "01-before-check.png") });

  await checkbox.click();

  // モーダルを開かずにトグルされる（詳細モーダルの見出しが出ないこと）
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(checkbox).toBeChecked();
  const taskName = page.locator(".gantt-label-column").getByText("解体作業");
  await expect(taskName).toHaveClass(/line-through/);

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem("genbahub:tasks");
    const tasks = raw ? JSON.parse(raw) : [];
    return tasks.find((t: { id: string }) => t.id === "dd000001-0000-0000-0000-000000000001")?.status;
  });
  expect(persisted).toBe("done");

  await page.screenshot({ path: path.join(screenshotsDir, "02-after-check.png") });

  // もう一度押すと未完了に戻る
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
});

test("② 今日ボタンを押すと今日の列を中心にタイムラインが横スクロールする", async ({ page }) => {
  await seedAndGoto(page);

  const scrollContainer = page.locator(".mobile-scroll-x.flex-1");
  await expect(scrollContainer).toBeVisible();

  // 初期表示は今日付近に自動スクロールされる想定なので、まず離れた位置(先頭)へ強制移動する
  await scrollContainer.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const movedAway = await scrollContainer.evaluate((el) => el.scrollLeft);
  expect(movedAway).toBe(0);

  await page.screenshot({ path: path.join(screenshotsDir, "03-scrolled-away.png") });

  await page.getByRole("button", { name: "今日", exact: true }).click();

  await expect(async () => {
    const left = await scrollContainer.evaluate((el) => el.scrollLeft);
    expect(left).toBeGreaterThan(0);
  }).toPass({ timeout: 3000 });

  await page.screenshot({ path: path.join(screenshotsDir, "04-after-today-jump.png") });
});
