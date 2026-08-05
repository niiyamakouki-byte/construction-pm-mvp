/**
 * COMPASS工程表UIフルクローンの視覚・直接操作検証。
 * 来歴: 2026-08-05 owner brief / Codex / branch design/ui-facelift-20260728
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const projectId = "55555555-5555-4555-8555-555555555555";
const screenshotDir = path.resolve("artifacts/compass-clone-20260805");

const project = {
  id: projectId,
  name: "銀座中央通り オフィス改装",
  description: "COMPASS UI verification",
  status: "active",
  mode: "normal",
  startDate: "2026-07-27",
  endDate: "2026-08-31",
  includeWeekends: false,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
};

const contractors = ["高橋内装", "中村電設", "佐藤建具"].map((name, index) => ({
  id: `cc55555${index}-5555-4555-8555-55555555555${index}`,
  name,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
}));

const tasks = [
  ["現地調査", "done", "2026-07-27", "2026-07-29", 100, "仮設工事", 0],
  ["デザイン最終確認", "done", "2026-07-30", "2026-08-02", 100, "仮設工事", 0],
  ["照明設計", "in_progress", "2026-08-03", "2026-08-07", 75, "電気工事", 1],
  ["電気配線工事", "in_progress", "2026-07-31", "2026-08-03", 50, "電気工事", 1],
  ["内装仕上げ工事", "in_progress", "2026-08-05", "2026-08-14", 20, "壁・天井仕上げ", 0],
  ["商品陳列・引渡し", "todo", "2026-08-12", "2026-08-18", 0, "検査", 2],
] as const;

const seededTasks = tasks.map(([name, status, startDate, dueDate, progress, majorCategory, contractorIndex], index) => ({
  id: `aa55555${index}-5555-4555-8555-55555555555${index}`,
  projectId,
  name,
  description: "",
  status,
  startDate,
  dueDate,
  progress,
  dependencies: [],
  contractorId: contractors[contractorIndex].id,
  majorCategory,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
}));

test.beforeEach(async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-08-05T09:00:00+09:00"));
  await bypassAuthWithSeed(page, {
    "genbahub:projects": [project],
    "genbahub:tasks": seededTasks,
    "genbahub:contractors": contractors,
    "genbahub:last-project-id": projectId,
  });
});

test("PC幅で固定3列・高密度行・今日面・遅延斜線を表示し、バーを直接移動できる", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/gantt");
  const chart = page.locator('[data-tour="gantt-chart"]');
  await expect(chart).toBeVisible();
  await expect(page.getByText("タスク名", { exact: true })).toBeVisible();
  await expect(page.getByText("担当", { exact: true })).toBeVisible();
  await expect(page.getByText("進捗", { exact: true })).toBeVisible();
  await expect(page.getByTestId("overdue-hatch")).toBeVisible();

  const labelBox = await page.locator(".gantt-label-column").boundingBox();
  expect(labelBox?.width).toBeGreaterThanOrEqual(340);
  const taskBar = page.locator('[data-task-id="aa555554-5555-4555-8555-555555555554"]');
  const barBox = await taskBar.boundingBox();
  expect(barBox).not.toBeNull();
  if (!barBox) throw new Error("工程バーの座標を取得できません");
  await page.screenshot({ path: path.join(screenshotDir, "pc-1-before-drag.png"), fullPage: false });

  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(barBox.x + barBox.width / 2 + 30, barBox.y + barBox.height / 2);
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem("genbahub:tasks");
    const stored = raw ? JSON.parse(raw) as Array<{ id: string; startDate?: string }> : [];
    return stored.find((task) => task.id === "aa555554-5555-4555-8555-555555555554")?.startDate;
  })).toBe("2026-08-06");

  await page.screenshot({ path: path.join(screenshotDir, "pc-1440x1000.png"), fullPage: false });

  // 端をつかんで伸縮（resize-endハンドル）
  const dueDateBeforeResize = await page.evaluate(() => {
    const raw = localStorage.getItem("genbahub:tasks");
    const stored = raw ? JSON.parse(raw) as Array<{ id: string; dueDate?: string }> : [];
    return stored.find((task) => task.id === "aa555554-5555-4555-8555-555555555554")?.dueDate;
  });
  const resizedBar = await taskBar.boundingBox();
  if (!resizedBar) throw new Error("ドラッグ後の工程バー座標を取得できません");
  const resizeHandle = taskBar.getByTestId("resize-end-handle");
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) throw new Error("伸縮ハンドルの座標を取得できません");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 60, handleBox.y + handleBox.height / 2);
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem("genbahub:tasks");
    const stored = raw ? JSON.parse(raw) as Array<{ id: string; dueDate?: string }> : [];
    return stored.find((task) => task.id === "aa555554-5555-4555-8555-555555555554")?.dueDate;
  })).not.toBe(dueDateBeforeResize); // 伸縮ハンドルのドラッグで終了日が変わることを確認
  await page.screenshot({ path: path.join(screenshotDir, "pc-3-after-resize.png"), fullPage: false });
});

test("タスク編集モーダルで開始〜終了の範囲が塗られたストリップを表示する", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/gantt");
  // タイムラインのスクロール位置に依存しない左パネルのタスク名クリックで詳細ダイアログを開き、
  // 「編集する」で日付入力ありの編集フォームへ進む
  await page.locator(".gantt-label-column").getByText("照明設計", { exact: true }).click();
  await page.getByRole("button", { name: "編集する" }).click();
  const strip = page.getByTestId("date-range-strip");
  await expect(strip).toBeVisible();
  const paintedCells = page.getByTestId("range-cell-painted");
  await expect(paintedCells).toHaveCount(5); // 照明設計: 2026-08-03〜08-07 = 5日
  await expect(paintedCells.first()).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "pc-4-modal-range-paint.png"), fullPage: false });
});

test("モバイル幅で全画面ガントへ切り替え、タッチ向け工程表を表示する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/gantt");
  await page.getByTestId("gantt-show-timeline").first().click();
  await expect(page.getByTestId("gantt-timeline-fullscreen")).toBeVisible();
  await expect(page.getByLabel("拡大")).toBeVisible();
  await expect(page.getByTestId("resize-start-handle").first()).toBeAttached();
  await expect(page.getByTestId("resize-end-handle").first()).toBeAttached();
  await page.screenshot({ path: path.join(screenshotDir, "mobile-390x844.png"), fullPage: false });
});

test("モバイル幅でタスク編集モーダルの範囲塗りストリップが画面内に収まる(恒久KPI)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/gantt");
  // モバイルは全画面タイムライン切替前でも左パネルのタスク名で詳細ダイアログを開ける
  await page.getByText("照明設計", { exact: true }).first().click();
  await page.getByRole("button", { name: "編集する" }).click();
  const strip = page.getByTestId("date-range-strip");
  await expect(strip).toBeVisible();
  const stripBox = await strip.boundingBox();
  expect(stripBox).not.toBeNull();
  if (stripBox) {
    expect(stripBox.x).toBeGreaterThanOrEqual(0);
    expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: path.join(screenshotDir, "mobile-modal-range-paint.png"), fullPage: false });
});
