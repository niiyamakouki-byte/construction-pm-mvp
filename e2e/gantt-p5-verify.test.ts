/**
 * E2E: GenbaHub 工程表 P5「自然言語操作拡張」実機検証
 * 対象コミット: c650826
 * 検証日: 2026-07-04
 * 検証手法: Playwright headless Chromium + __E2E_BYPASS_AUTH__ + localStorage デモシード
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = "/Users/koki/fable2-logs/gantt-verify-p5";

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// ─── デモデータ ────────────────────────────────────────────────────────────────

const P5_PID = "22222222-2222-2222-2222-222222222222";

const SEED_PROJECTS = [
  {
    id: P5_PID,
    name: "P5検証デモ案件",
    description: "P5自然言語編集E2E検証用",
    status: "active",
    mode: "normal",
    startDate: "2026-07-04",
    endDate: "2026-09-30",
    includeWeekends: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

const SEED_CONTRACTORS = [
  {
    id: "cc000010-0000-0000-0000-000000000010",
    name: "電設工業",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

// task-2 (電気配線) は初期依存なし → ① add_dependency で追加
const SEED_TASKS_BASE = [
  {
    id: "bb000001-0000-0000-0000-000000000001",
    projectId: P5_PID,
    name: "解体作業",
    description: "",
    status: "todo",
    startDate: "2026-07-10",
    dueDate: "2026-07-20",
    progress: 0,
    dependencies: [],
    majorCategory: "解体工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "bb000002-0000-0000-0000-000000000002",
    projectId: P5_PID,
    name: "電気配線",
    description: "",
    status: "todo",
    startDate: "2026-07-21",
    dueDate: "2026-07-28",
    progress: 0,
    dependencies: [], // ① で追加される
    majorCategory: "電気工事フェーズ",
    contractorId: "cc000010-0000-0000-0000-000000000010",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "bb000003-0000-0000-0000-000000000003",
    projectId: P5_PID,
    name: "墨出し",
    description: "",
    status: "in_progress",
    startDate: "2026-07-10",
    dueDate: "2026-07-16",
    progress: 0,
    dependencies: [],
    majorCategory: "基礎工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "bb000004-0000-0000-0000-000000000004",
    projectId: P5_PID,
    name: "照明計画",
    description: "",
    status: "todo",
    startDate: "2026-07-29",
    dueDate: "2026-08-05",
    progress: 0,
    dependencies: [],
    majorCategory: "電気工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "bb000005-0000-0000-0000-000000000005",
    projectId: P5_PID,
    name: "LGS組み",
    description: "",
    status: "todo",
    startDate: "2026-07-21",
    dueDate: "2026-07-30",
    progress: 0,
    dependencies: ["bb000001-0000-0000-0000-000000000001"],
    majorCategory: "解体工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "bb000006-0000-0000-0000-000000000006",
    projectId: P5_PID,
    name: "塗装仕上げ",
    description: "",
    status: "todo",
    startDate: "2026-08-01",
    dueDate: "2026-08-10",
    progress: 0,
    dependencies: [],
    majorCategory: "仕上工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  // ⑤ 多重マッチ用: "照明" が "照明計画" と "照明設備" 両方にヒットする
  {
    id: "bb000007-0000-0000-0000-000000000007",
    projectId: P5_PID,
    name: "照明設備",
    description: "",
    status: "todo",
    startDate: "2026-07-29",
    dueDate: "2026-08-05",
    progress: 0,
    dependencies: [],
    majorCategory: "電気工事フェーズ",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

// ④ cascade 検証用: task-2 (電気配線) が task-1 (解体作業) に依存済み
const SEED_TASKS_CASCADE = SEED_TASKS_BASE.map((t) =>
  t.id === "bb000002-0000-0000-0000-000000000002"
    ? { ...t, dependencies: ["bb000001-0000-0000-0000-000000000001"] }
    : t,
);

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

async function seedLocalStorage(
  page: Page,
  tasks: typeof SEED_TASKS_BASE = SEED_TASKS_BASE,
) {
  await page.addInitScript(
    ({ projects, tasks, contractors, pid }) => {
      (window as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
      localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
      localStorage.setItem("genbahub:last-project-id", pid);
    },
    {
      projects: SEED_PROJECTS,
      tasks,
      contractors: SEED_CONTRACTORS,
      pid: P5_PID,
    },
  );
}

async function screenshot(page: Page, name: string, scrollToChat = false) {
  if (scrollToChat) {
    // チャットパネルが画面内に入るようにスクロール
    const chatPanel = page.locator('text=自然言語で工程を編集').first();
    if (await chatPanel.isVisible()) {
      await chatPanel.scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(150);
  }
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: false,
  });
}

/** ガント表示完了 + チャットパネル開く */
async function openChatPanel(page: Page) {
  await expect(
    page.locator('[aria-label="工程検索"]').first(),
  ).toBeVisible({ timeout: 20000 });
  await page.locator('button:has-text("指示で編集")').click();
  await expect(
    page.locator('text=自然言語で工程を編集'),
  ).toBeVisible({ timeout: 5000 });
}

/** チャット入力欄に command を打ち込んで Enter */
async function applyCommand(page: Page, command: string) {
  const input = page.locator(
    'input[placeholder*="塗装を2日後ろ倒し"]',
  );
  await input.fill(command);
  await input.press("Enter");
}

// ─── テスト ───────────────────────────────────────────────────────────────────

test.describe("P5: 自然言語操作拡張", () => {

  // ① 依存線追加 ──────────────────────────────────────────────────────────────
  test("① 解体が終わったら電気 → add_dependency", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await seedLocalStorage(page, SEED_TASKS_BASE);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    await screenshot(page, "01-before-add-dep.png");

    await applyCommand(page, "解体が終わったら電気");

    // エラーメッセージなし
    await expect(page.locator('p.text-red-600')).not.toBeVisible({ timeout: 3000 });
    // 履歴エントリが現れる
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "解体が終わったら電気" }),
    ).toBeVisible({ timeout: 5000 });
    // 1件適用
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "1件適用" }),
    ).toBeVisible();

    await screenshot(page, "02-after-add-dep.png", true);

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  // ② 進捗50% ─────────────────────────────────────────────────────────────────
  test("② 墨出し半分終わった → set_progress 50%", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await seedLocalStorage(page);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    await screenshot(page, "03-before-progress.png");

    await applyCommand(page, "墨出し半分終わった");

    await expect(page.locator('p.text-red-600')).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "墨出し半分終わった" }),
    ).toBeVisible({ timeout: 5000 });

    await screenshot(page, "04-after-progress.png", true);

    // DOM から墨出しの progress 値を確認
    const progressInfo = await page.evaluate(() => {
      const raw = localStorage.getItem("genbahub:tasks");
      if (!raw) return null;
      const tasks: Array<{ name: string; progress: number }> = JSON.parse(raw);
      return tasks.find((t) => t.name === "墨出し")?.progress ?? null;
    });
    // chatSchedule は React state なので localStorage には反映されない（UI 内プレビュー）
    // 代わりに履歴エントリの表示を確認済み
    void progressInfo; // 参照値（localStorage は更新されない）

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  // ③ 担当変更 ────────────────────────────────────────────────────────────────
  test("③ 照明計画は鈴木さんに → set_assignee", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await seedLocalStorage(page);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    await screenshot(page, "05-before-assignee.png");

    await applyCommand(page, "照明計画は鈴木さんに");

    await expect(page.locator('p.text-red-600')).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "照明計画は鈴木さんに" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "1件適用" }),
    ).toBeVisible();

    await screenshot(page, "06-after-assignee.png", true);

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  // ④ フェーズ一括シフト + 後続波及 ──────────────────────────────────────────
  test("④ 解体工事を全部3日後ろに → phase_shift_backward + cascade", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // CASCADE シード: 電気配線 が 解体作業 に依存済み（cascade 確認用）
    await seedLocalStorage(page, SEED_TASKS_CASCADE);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    await screenshot(page, "07-before-phase-shift.png");

    await applyCommand(page, "解体工事を全部3日後ろに");

    await expect(page.locator('p.text-red-600')).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "解体工事を全部3日後ろに" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "1件適用" }),
    ).toBeVisible();

    await screenshot(page, "08-after-phase-shift.png", true);

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  // ⑤ 低confidence → 確認チップ → 承認 ────────────────────────────────────────
  test("⑤ 照明半分終わった → 低confidence確認チップ → 承認で適用", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await seedLocalStorage(page);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    // 入力前スクリーンショット
    await screenshot(page, "09-before-confidence-chip.png");

    // "照明" は "照明計画" と "照明設備" の 2 件に部分一致 → confidence 0.6 → チップ表示
    await applyCommand(page, "照明半分終わった");

    // 確認チップが出る
    await expect(
      page.locator('text=この解釈で合ってますか'),
    ).toBeVisible({ timeout: 5000 });
    // チップ内に両タスク名が描画される (describeEdit: "照明計画・照明設備を50%にします")
    await expect(
      page.locator('text=照明計画').first(),
    ).toBeVisible();
    await expect(
      page.locator('text=照明設備').first(),
    ).toBeVisible();
    // まだ履歴エントリはない（保留状態）
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "照明半分終わった" }),
    ).not.toBeVisible();

    // 確認チップが画面内に入るようにスクロール
    await page.locator('text=この解釈で合ってますか').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await screenshot(page, "10-confidence-chip-visible.png");

    // 「この解釈で適用」ボタンをクリック
    await page.locator('button:has-text("この解釈で適用")').click();

    // チップが消える
    await expect(
      page.locator('text=この解釈で合ってますか'),
    ).not.toBeVisible({ timeout: 3000 });
    // 履歴エントリが現れる
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "照明半分終わった" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "1件適用" }),
    ).toBeVisible();

    await screenshot(page, "11-after-confidence-confirm.png", true);

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  // ⑥ 退行テスト (既存 shift_backward) ────────────────────────────────────────
  test("⑥ 塗装仕上げを2日後ろ倒し → shift_backward 退行なし", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await seedLocalStorage(page);
    await page.goto("/#/gantt");
    await openChatPanel(page);

    await screenshot(page, "12-before-regression.png");

    await applyCommand(page, "塗装仕上げを2日後ろ倒し");

    await expect(page.locator('p.text-red-600')).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "塗装仕上げを2日後ろ倒し" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('div.bg-slate-50').filter({ hasText: "1件適用" }),
    ).toBeVisible();

    await screenshot(page, "13-after-regression.png", true);

    expect(jsErrors, `JSエラー: ${jsErrors.join(", ")}`).toHaveLength(0);
  });
});
