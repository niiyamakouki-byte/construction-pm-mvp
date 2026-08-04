/**
 * E2E: 票laporta-beads-lzurb「[compass] サマリ帯を既存帯へ統合(今日納品/遅延)」実機検証
 * 検証手法: Playwright headless Chromium + __E2E_BYPASS_AUTH__ + localStorage デモシード
 * 発注(納期マーカー)は非Supabaseモードでもインメモリ管理のため、Ordersページのフォームから実際に作成する。
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "lzurb-verify");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PID = "44444444-4444-4444-4444-444444444444";
const TODAY_TASK_ID = "ee000001-0000-0000-0000-000000000001";
const OVERDUE_TASK_ID = "ee000002-0000-0000-0000-000000000002";

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = toLocalDateString(new Date());

const SEED_PROJECTS = [
  {
    id: PID,
    name: "lzurb検証デモ案件",
    description: "サマリ帯統合(今日納品/遅延) E2E検証用",
    status: "active",
    mode: "normal",
    startDate: "2020-01-01",
    endDate: "2026-12-31",
    includeWeekends: true,
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
  },
];

const SEED_TASKS = [
  {
    id: TODAY_TASK_ID,
    projectId: PID,
    name: "建具搬入",
    description: "",
    status: "in_progress",
    startDate: "2020-01-01",
    dueDate: "2026-12-01",
    progress: 30,
    dependencies: [],
    majorCategory: "内装工事",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
  },
  {
    id: OVERDUE_TASK_ID,
    projectId: PID,
    name: "解体作業",
    description: "",
    status: "todo",
    startDate: "2020-01-01",
    dueDate: "2020-01-10",
    progress: 0,
    dependencies: [],
    majorCategory: "解体工事",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
  },
];

test("既存の遅延・次工程サマリ帯に「今日納品」件数が統合表示され、新規の別帯は増えない", async ({ page }) => {
  await bypassAuthWithSeed(page, {
    "genbahub:projects": SEED_PROJECTS,
    "genbahub:tasks": SEED_TASKS,
    "genbahub:contractors": [],
    "genbahub:last-project-id": PID,
  });

  // ① Ordersページで本日納期・建具搬入に紐づけた発注を実際に作成する(インメモリのためUI経由が必須)
  // 納期・紐づける工程の<label>はhtmlFor/id未設定のためgetByLabelは使えず、フォーム内の出現順で特定する
  await page.goto("/#/orders");
  await page.getByRole("button", { name: "+ 発注書作成" }).click();

  const form = page.locator("form");
  await form.locator('input[type="date"]').fill(TODAY);
  await form.getByRole("combobox").nth(1).selectOption(TODAY_TASK_ID); // 0=業者, 1=紐づける工程
  await form.locator('select[aria-label*="品目選択"]').first().selectOption({ index: 1 });

  await page.screenshot({ path: path.join(screenshotsDir, "01-order-form-filled.png") });

  await page.getByRole("button", { name: "下書き保存" }).click();
  await expect(page.getByRole("heading", { name: "発注書作成" })).toHaveCount(0);

  // ② ガントページへ移動し、既存サマリ帯(遅延・次工程と同じdiv)に「今日納品」件数が出ることを確認
  await page.goto("/#/gantt");
  await expect(page.getByRole("heading", { name: "lzurb検証デモ案件" })).toBeVisible();

  const todayDeliveryPill = page.getByText("今日納品 1件");
  await expect(todayDeliveryPill).toBeVisible();
  const delayedPill = page.getByText("遅延 1件");
  await expect(delayedPill).toBeVisible();

  // 既存帯へ統合(新設帯ではない): 遅延と今日納品が同じ親コンテナに同居していること
  const todayDeliveryParent = await todayDeliveryPill.evaluate((el) => el.parentElement?.className);
  const delayedParent = await delayedPill.evaluate((el) => el.parentElement?.className);
  expect(todayDeliveryParent).toBe(delayedParent);

  // 旧「日次サマリ帯」新設パターン(進行中/今日開始/今日締切)は出ていない
  await expect(page.getByText(/今日開始/)).toHaveCount(0);
  await expect(page.getByText(/今日締切/)).toHaveCount(0);

  await page.screenshot({ path: path.join(screenshotsDir, "02-gantt-summary-band.png"), fullPage: false });
});
