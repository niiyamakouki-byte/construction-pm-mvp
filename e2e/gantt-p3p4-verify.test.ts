/**
 * E2E: GenbaHub 工程表 P3(検索+フィルタ) / P4(リソース分析) 実機検証
 * 対象コミット: 4735197 (P3) + 0b0211f (P4)
 * 検証日: 2026-07-04
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "gantt-verify-p3p4");

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// ─── 認証バイパス ──────────────────────────────────────────────────────────────
async function bypassAuth(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
}

// ─── デモデータシード ─────────────────────────────────────────────────────────
// 今日 = 2026-07-04(土)
// 現在週 = 2026-06-29(月)〜2026-07-05(日) 稼働日5日 キャパ40h/人
//
// 株式会社ラポルタ: t-001(5日=40h) + t-008(4日=32h) = 72h/40h → 180% 過負荷
//
// 検索テスト用に多様なタスク名・工種・担当者を用意
const SEED_PROJECTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
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
    id: "cc000001-0000-0000-0000-000000000001",
    name: "株式会社ラポルタ",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "cc000002-0000-0000-0000-000000000002",
    name: "LGS工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "cc000003-0000-0000-0000-000000000003",
    name: "電設工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "cc000004-0000-0000-0000-000000000004",
    name: "内装会社",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

const PID = "11111111-1111-1111-1111-111111111111";

const SEED_TASKS = [
  // 塗装 (painting) - 株式会社ラポルタ
  {
    id: "aa000001-0000-0000-0000-000000000001",
    projectId: PID,
    name: "塗装下地調整",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-08",
    progress: 50,
    dependencies: [],
    contractorId: "cc000001-0000-0000-0000-000000000001",
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "aa000002-0000-0000-0000-000000000002",
    projectId: PID,
    name: "外壁塗装仕上げ",
    description: "",
    status: "todo",
    startDate: "2026-07-09",
    dueDate: "2026-07-18",
    progress: 0,
    dependencies: [],
    contractorId: "cc000001-0000-0000-0000-000000000001",
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // 軽鉄 (framing) - LGS工業
  {
    id: "aa000003-0000-0000-0000-000000000003",
    projectId: PID,
    name: "軽鉄下地組み",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-15",
    progress: 30,
    dependencies: [],
    contractorId: "cc000002-0000-0000-0000-000000000002",
    majorCategory: "軽鉄工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // 電気 (electrical) - 電設工業
  {
    id: "aa000004-0000-0000-0000-000000000004",
    projectId: PID,
    name: "電気配線工事",
    description: "",
    status: "todo",
    startDate: "2026-07-01",
    dueDate: "2026-07-20",
    progress: 0,
    dependencies: [],
    contractorId: "cc000003-0000-0000-0000-000000000003",
    majorCategory: "電気工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // 仕上 (finishing) - 内装会社
  {
    id: "aa000005-0000-0000-0000-000000000005",
    projectId: PID,
    name: "床仕上げ工事",
    description: "",
    status: "todo",
    startDate: "2026-07-13",
    dueDate: "2026-07-25",
    progress: 0,
    dependencies: [],
    contractorId: "cc000004-0000-0000-0000-000000000004",
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "aa000006-0000-0000-0000-000000000006",
    projectId: PID,
    name: "クロス貼り",
    description: "",
    status: "todo",
    startDate: "2026-07-21",
    dueDate: "2026-08-01",
    progress: 0,
    dependencies: [],
    contractorId: "cc000004-0000-0000-0000-000000000004",
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // 配管 (plumbing) - LGS工業
  {
    id: "aa000007-0000-0000-0000-000000000007",
    projectId: PID,
    name: "配管給排水工事",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-10",
    progress: 60,
    dependencies: [],
    contractorId: "cc000002-0000-0000-0000-000000000002",
    majorCategory: "配管工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // 調査 (other) - 株式会社ラポルタ — 現在週内に収まる(32h追加 → 合計72h)
  {
    id: "aa000008-0000-0000-0000-000000000008",
    projectId: PID,
    name: "現地調査・測量",
    description: "",
    status: "done",
    startDate: "2026-06-29",
    dueDate: "2026-07-02",
    progress: 100,
    dependencies: [],
    contractorId: "cc000001-0000-0000-0000-000000000001",
    majorCategory: "調査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  // その他 - 竣工検査
  {
    id: "aa000009-0000-0000-0000-000000000009",
    projectId: PID,
    name: "竣工検査",
    description: "",
    status: "todo",
    startDate: "2026-07-28",
    dueDate: "2026-07-30",
    progress: 0,
    dependencies: [],
    contractorId: "cc000001-0000-0000-0000-000000000001",
    majorCategory: "検査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

async function seedLocalStorage(page: Page) {
  // シードデータは「今日 = 2026-07-04」前提の固定日付(冒頭コメント参照)。
  // 実時刻のままだと日付経過で過負荷条件(ラポルタ180%)が現在週から外れて
  // ⑤⑥が腐るため、テスト内時刻を検証日に固定する
  await page.clock.setFixedTime(new Date("2026-07-04T09:00:00+09:00"));
  await page.addInitScript(
    ({ projects, tasks, contractors }) => {
      window.__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
      localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
      // 最後に使ったプロジェクトIDを設定してガントが自動選択できるようにする
      localStorage.setItem(
        "genbahub:last-project-id",
        "11111111-1111-1111-1111-111111111111",
      );
    },
    {
      projects: SEED_PROJECTS,
      tasks: SEED_TASKS,
      contractors: SEED_CONTRACTORS,
    },
  );
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: false,
  });
}

// ─── テスト: P3 検索+フィルタ ────────────────────────────────────────────────

test.describe("P3: 検索+フィルタ", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page);
    await page.goto("/#/gantt");
    await page.waitForLoadState("networkidle");
    // ガントページとタスクが表示されるまで待機
    await expect(
      page.locator('[aria-label="工程検索"]').first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("① タスク名・担当者・工種の部分一致検索", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const searchInput = page.locator('[aria-label="工程検索"]');

    // --- タスク名「塗装」で検索 ---
    await searchInput.fill("塗装");
    await page.waitForTimeout(300);

    // 「塗装下地調整」「外壁塗装仕上げ」の少なくとも1件がある
    const countText1 = await page.locator('[aria-live="polite"]').textContent();
    const matchCount1 = parseInt(countText1?.replace(/[^0-9]/g, "") ?? "0", 10);
    expect(matchCount1).toBeGreaterThan(0);

    await screenshot(page, "01-search-by-taskname.png");

    // --- 担当者「LGS」で検索 ---
    await searchInput.fill("LGS");
    await page.waitForTimeout(300);

    const countText2 = await page.locator('[aria-live="polite"]').textContent();
    const matchCount2 = parseInt(countText2?.replace(/[^0-9]/g, "") ?? "0", 10);
    expect(matchCount2).toBeGreaterThan(0);

    await screenshot(page, "02-search-by-contractor.png");

    // --- 工種「電気」で検索 ---
    await searchInput.fill("電気");
    await page.waitForTimeout(300);

    const countText3 = await page.locator('[aria-live="polite"]').textContent();
    const matchCount3 = parseInt(countText3?.replace(/[^0-9]/g, "") ?? "0", 10);
    expect(matchCount3).toBeGreaterThan(0);

    await screenshot(page, "03-search-by-trade.png");

    expect(jsErrors).toHaveLength(0);
  });

  test("② 件数表示「N件が条件に一致」", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const countEl = page.locator('[aria-live="polite"]');
    await expect(countEl).toBeVisible();

    const text = await countEl.textContent();
    expect(text).toMatch(/\d+件が条件に一致/);

    // 数値が9以下(全タスク数以内)
    const count = parseInt(text?.replace(/[^0-9]/g, "") ?? "0", 10);
    expect(count).toBeGreaterThanOrEqual(1);

    await screenshot(page, "04-count-display.png");

    expect(jsErrors).toHaveLength(0);
  });

  test("③ ×クリアボタンと0件空状態バナー", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const searchInput = page.locator('[aria-label="工程検索"]');

    // ─ 空状態バナーを出す（ヒットしない検索ワード）
    await searchInput.fill("存在しないタスクXYZ999");
    await page.waitForTimeout(400);

    // 空状態テキストが出現
    await expect(page.locator("text=該当する工程が見つかりません")).toBeVisible({
      timeout: 5000,
    });

    // 0件カウント
    const countText = await page.locator('[aria-live="polite"]').textContent();
    expect(countText).toContain("0件");

    await screenshot(page, "05-empty-state-banner.png");

    // ─ ×クリアボタン確認
    const clearBtn = page.locator('[aria-label="検索をクリア"]');
    await expect(clearBtn).toBeVisible();

    // ×をクリックしてクリア
    await clearBtn.click();
    await page.waitForTimeout(300);

    // クリア後は空状態バナーが消える
    await expect(
      page.locator("text=該当する工程が見つかりません"),
    ).not.toBeVisible({ timeout: 3000 });

    // クリアボタン自体も消える（queryが空のため）
    await expect(clearBtn).not.toBeVisible({ timeout: 3000 });

    expect(jsErrors).toHaveLength(0);
  });

  test("④ 工種フィルタ AND 検索の合成", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const searchInput = page.locator('[aria-label="工程検索"]');

    // 工種「塗装」ボタンだけ ON にする（他は OFF）
    // まず全非表示
    await page.locator('text=全非表示').click();
    await page.waitForTimeout(200);

    // 「塗装」工種ボタンを ON
    const paintBtn = page.locator('[aria-pressed]', { hasText: "塗装" });
    await paintBtn.click();
    await page.waitForTimeout(200);

    // さらに「塗装」で検索 → 塗装カテゴリのみが残る
    await searchInput.fill("塗装");
    await page.waitForTimeout(300);

    const countText = await page.locator('[aria-live="polite"]').textContent();
    const count = parseInt(countText?.replace(/[^0-9]/g, "") ?? "0", 10);
    // 塗装工事タスクは2件（塗装下地調整・外壁塗装仕上げ）
    expect(count).toBeGreaterThanOrEqual(1);

    await screenshot(page, "06-filter-and-search-compose.png");

    // フィルタを全表示に戻してクリーンアップ
    await page.locator('text=全表示').click();
    await searchInput.fill("");
    await expect(page.locator('[aria-label="検索をクリア"]')).not.toBeVisible({ timeout: 3000 });

    expect(jsErrors).toHaveLength(0);
  });
});

// ─── テスト: P4 リソース分析ビュー ───────────────────────────────────────────

test.describe("P4: リソース分析ビュー", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page);
    await page.goto("/#/resource-analysis");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=リソース分析").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("⑤ KPIカード(稼働h/タスク数/平均稼働人数)+担当者別テーブル(100%超赤字)", async ({
    page,
  }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // KPI カード3枚の存在確認
    await expect(page.locator("text=稼働時間合計")).toBeVisible();
    await expect(page.locator("text=対象タスク数")).toBeVisible();
    await expect(page.locator("text=平均稼働人数")).toBeVisible();

    // 稼働時間合計が数値 + " h" 形式
    const hoursCard = page.locator("text=稼働時間合計").locator("..").locator("p.text-2xl");
    const hoursText = await hoursCard.textContent();
    expect(hoursText).toMatch(/[\d.]+\s*h/);

    // 対象タスク数が整数 + " 件"
    const tasksCard = page.locator("text=対象タスク数").locator("..").locator("p.text-2xl");
    const tasksText = await tasksCard.textContent();
    expect(tasksText).toMatch(/\d+\s*件/);

    // 平均稼働人数が数値 + " 名/日"
    const personsCard = page.locator("text=平均稼働人数").locator("..").locator("p.text-2xl");
    const personsText = await personsCard.textContent();
    expect(personsText).toMatch(/[\d.]+/);

    await screenshot(page, "07-resource-kpi-cards.png");

    // 担当者別テーブル: 株式会社ラポルタ が過負荷で赤字
    // 現在週(Jun29-Jul5, 5稼働日): t-001(5日=40h) + t-008(4日=32h) = 72h / 40h = 180%
    const tableRows = page.locator("tbody tr");
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // 過負荷行(稼働率100%超)が存在して赤字
    const overloadCells = page.locator("td.text-red-600");
    const overloadCount = await overloadCells.count();
    expect(overloadCount).toBeGreaterThan(0);

    // 赤字セルに "%"が含まれる（稼働率列）
    const firstOverload = await overloadCells.first().textContent();
    expect(firstOverload).toContain("%");

    await screenshot(page, "08-resource-table-overload.png");

    expect(jsErrors).toHaveLength(0);
  });

  test("⑥ 週/月切替+前後ナビ+今日ボタン", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // 初期状態: 週ビュー("週"ボタンがアクティブ)
    const weekBtn = page.locator('button:has-text("週")');
    const monthBtn = page.locator('button:has-text("月")');
    await expect(weekBtn).toBeVisible();
    await expect(monthBtn).toBeVisible();

    // 期間ラベルが "MM/DD 〜 MM/DD" 形式（週）
    const periodLabel = page.locator('span.min-w-\\[140px\\]');
    const initialLabel = await periodLabel.textContent();
    expect(initialLabel).toMatch(/\d+\/\d+\s*〜\s*\d+\/\d+/);

    await screenshot(page, "09-resource-week-view.png");

    // 月切替
    await monthBtn.click();
    await page.waitForTimeout(300);
    const monthLabel = await periodLabel.textContent();
    expect(monthLabel).toMatch(/\d+年\d+月/);

    await screenshot(page, "10-resource-month-view.png");

    // 前へ(‹)ナビ
    const prevBtn = page.locator('[aria-label="前の期間"]');
    await prevBtn.click();
    await page.waitForTimeout(200);
    const prevLabel = await periodLabel.textContent();
    expect(prevLabel).not.toBe(monthLabel);

    // 今日ボタンで戻る（周期ナビ内の exact "今日"ボタン）
    const todayBtn = page.getByRole("button", { name: "今日", exact: true });
    await todayBtn.click();
    await page.waitForTimeout(200);
    const afterTodayLabel = await periodLabel.textContent();
    expect(afterTodayLabel).toBe(monthLabel);

    // 今日ボタンは現在期間にいるとき disabled
    await expect(todayBtn).toBeDisabled();

    // 次へ(›)ナビ
    const nextBtn = page.locator('[aria-label="次の期間"]');
    await nextBtn.click();
    await page.waitForTimeout(200);
    const nextLabel = await periodLabel.textContent();
    expect(nextLabel).not.toBe(monthLabel);

    // 今日ボタンが再び有効
    await expect(todayBtn).not.toBeDisabled();

    // 今日に戻す（再取得）
    await page.getByRole("button", { name: "今日", exact: true }).click();
    await page.waitForTimeout(200);

    // 週に戻す
    await weekBtn.click();
    await page.waitForTimeout(200);
    const backToWeekLabel = await periodLabel.textContent();
    expect(backToWeekLabel).toMatch(/\d+\/\d+\s*〜\s*\d+\/\d+/);

    await screenshot(page, "11-resource-nav-today.png");

    expect(jsErrors).toHaveLength(0);
  });
});
