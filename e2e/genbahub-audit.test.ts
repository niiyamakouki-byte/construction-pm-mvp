/**
 * E2E: GenbaHub 全ページ粗探し監査テスト
 * 対象: /app, /tasks, /estimate, /finishing, /progress-review,
 *       /safety, /phase-templates, /contractors
 * 検証日: 2026-07-04
 */
import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = "/Users/koki/fable2-logs/genbahub-audit-0704";

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// ─── SEEDデータ（UUID v4形式 — スキーマ検証警告なし） ─────────────────────────
// gantt-p3p4-verify.test.tsは旧フォーマット(非v4 UUID)のまま維持。
// このテストでは正規のUUID v4を使用してschema warningを解消する。
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
  {
    id: "4b8c171e-5a00-4815-a5c0-46f65563d41c",
    name: "LGS工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "d7c98e6a-7dd3-4906-9573-c9049bf81f98",
    name: "電設工業",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "7b4354d2-fecf-4398-bdb9-4cb56841ee4d",
    name: "内装会社",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

const PID = "4b9e1234-5678-4abc-bdef-000000000001";

// Contractor IDs (copied from SEED_CONTRACTORS above for reference)
const CID_RAPORTA  = "0a3969bb-bc5c-4b47-afe6-09d7447894dd";
const CID_LGS      = "4b8c171e-5a00-4815-a5c0-46f65563d41c";
const CID_DENSETSU = "d7c98e6a-7dd3-4906-9573-c9049bf81f98";
const CID_NAISOU   = "7b4354d2-fecf-4398-bdb9-4cb56841ee4d";

const SEED_TASKS = [
  {
    id: "17275fb3-4d06-474b-8974-1839d47698e3",
    projectId: PID,
    name: "塗装下地調整",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-08",
    progress: 50,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "de1fe84f-6598-45c8-9e4b-acbcd5967c63",
    projectId: PID,
    name: "外壁塗装仕上げ",
    description: "",
    status: "todo",
    startDate: "2026-07-09",
    dueDate: "2026-07-18",
    progress: 0,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "塗装工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "1650ce1b-3881-4b18-ae69-4938e934878e",
    projectId: PID,
    name: "軽鉄下地組み",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-15",
    progress: 30,
    dependencies: [],
    contractorId: CID_LGS,
    majorCategory: "軽鉄工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "dbad5511-ce98-4b10-bf8d-878ab062c98e",
    projectId: PID,
    name: "電気配線工事",
    description: "",
    status: "todo",
    startDate: "2026-07-01",
    dueDate: "2026-07-20",
    progress: 0,
    dependencies: [],
    contractorId: CID_DENSETSU,
    majorCategory: "電気工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "cd813529-219b-4979-b832-00b737d413f7",
    projectId: PID,
    name: "床仕上げ工事",
    description: "",
    status: "todo",
    startDate: "2026-07-13",
    dueDate: "2026-07-25",
    progress: 0,
    dependencies: [],
    contractorId: CID_NAISOU,
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "48430cd2-3bc4-448e-936d-3e71ae76ef25",
    projectId: PID,
    name: "クロス貼り",
    description: "",
    status: "todo",
    startDate: "2026-07-21",
    dueDate: "2026-08-01",
    progress: 0,
    dependencies: [],
    contractorId: CID_NAISOU,
    majorCategory: "仕上工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "e1046b34-71cb-4410-8e7f-f334bd0d9602",
    projectId: PID,
    name: "配管給排水工事",
    description: "",
    status: "in_progress",
    startDate: "2026-06-29",
    dueDate: "2026-07-10",
    progress: 60,
    dependencies: [],
    contractorId: CID_LGS,
    majorCategory: "配管工事",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "a2e2a8d5-30cd-4957-b93c-b6b2c566a495",
    projectId: PID,
    name: "現地調査・測量",
    description: "",
    status: "done",
    startDate: "2026-06-29",
    dueDate: "2026-07-02",
    progress: 100,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "調査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "74fb0b5a-0df5-4f3d-a85d-e62cc004a755",
    projectId: PID,
    name: "竣工検査",
    description: "",
    status: "todo",
    startDate: "2026-07-28",
    dueDate: "2026-07-30",
    progress: 0,
    dependencies: [],
    contractorId: CID_RAPORTA,
    majorCategory: "検査",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];

// ─── 認証バイパス + LocalStorageシード ────────────────────────────────────────
async function seedLocalStorage(page: Page) {
  await page.addInitScript(
    ({ projects, tasks, contractors }) => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
      localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
      localStorage.setItem(
        "genbahub:last-project-id",
        "4b9e1234-5678-4abc-bdef-000000000001",
      );
    },
    {
      projects: SEED_PROJECTS,
      tasks: SEED_TASKS,
      contractors: SEED_CONTRACTORS,
    },
  );
}

// ─── スクリーンショットヘルパー ───────────────────────────────────────────────
async function screenshotFull(page: Page, name: string) {
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: true,
  });
}

// ─── 不正テキストチェック ─────────────────────────────────────────────────────
async function checkNoBadText(page: Page): Promise<string[]> {
  const bodyText = await page.locator("body").innerText();
  const badPatterns = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/];
  const found: string[] = [];
  for (const pattern of badPatterns) {
    if (pattern.test(bodyText)) {
      // Extract context around the bad text
      const match = bodyText.match(new RegExp(`.{0,30}${pattern.source}.{0,30}`, "g"));
      if (match) {
        found.push(`[${pattern.source}] → "${match.slice(0, 3).join(", ")}"`);
      }
    }
  }
  return found;
}

// ─── コンソールエラー収集 ─────────────────────────────────────────────────────
function collectConsoleErrors(page: Page): { errors: string[]; warns: string[] } {
  const errors: string[] = [];
  const warns: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
    if (msg.type() === "warning") warns.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
  return { errors, warns };
}

// ─── テストスイート ───────────────────────────────────────────────────────────

test.describe("GenbaHub 全ページ監査", () => {

  // ① ダッシュボード /app
  test("01_dashboard /app — 案件一覧表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/app");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページタイトル要素が存在する
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });

    // スクリーンショット(デスクトップ)
    await screenshotFull(page, "dashboard-desktop.png");

    // モバイル390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "dashboard-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // デモデータが表示されている（案件名）
    await expect(page.locator("text=GenbaHubデモ案件")).toBeVisible({ timeout: 5000 });

    // コンソールエラー記録（テスト失敗させずに記録のみ）
    console.log(`[/app] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ② タスク一覧 /tasks
  test("02_tasks /tasks — タスク一覧表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/tasks");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ローディングが終わること
    await expect(page.locator('[role="status"][aria-label="読み込み中"]')).not.toBeVisible({ timeout: 10000 });

    // ページヘッダー
    await expect(page.locator("h1")).toContainText("案件タスク一覧");

    // デスクトップSS
    await screenshotFull(page, "tasks-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "tasks-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // タスクが表示されている
    await expect(page.locator("text=塗装下地調整")).toBeVisible({ timeout: 5000 });

    console.log(`[/tasks] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ③ 見積 /estimate
  test("03_estimate /estimate — 見積ページ表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/estimate");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページが404でないことを確認
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("ページが見つかりません");

    // デスクトップSS
    await screenshotFull(page, "estimate-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "estimate-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // 何らかのUI要素が表示される
    await expect(page.locator("h1, h2, [role='tab']").first()).toBeVisible({ timeout: 10000 });

    console.log(`[/estimate] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ④ 仕上表 /finishing
  test("04_finishing /finishing — 仕上表ページ表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/finishing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページが404でないことを確認
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("ページが見つかりません");

    // デスクトップSS
    await screenshotFull(page, "finishing-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "finishing-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // 仕上表固有UI要素 — 部屋名ヘッダーか素材列名が表示されるか確認
    const finishingLocators = [
      page.locator("text=床材"),
      page.locator("text=仕上表"),
      page.locator("text=部屋"),
      page.locator("text=LDK"),
      page.locator("text=ナチュラル系"),
    ];
    let hasFinishingContent = false;
    for (const loc of finishingLocators) {
      const count = await loc.count();
      if (count > 0) { hasFinishingContent = true; break; }
    }
    expect(hasFinishingContent, "仕上表のUI要素が見つからない").toBe(true);

    console.log(`[/finishing] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑤ 進捗レビュー /progress-review
  test("05_progress_review /progress-review — 進捗レビューページ表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/progress-review");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページが404でないことを確認
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("ページが見つかりません");

    // デスクトップSS
    await screenshotFull(page, "progress-review-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "progress-review-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // 何らかのUI要素が表示される
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });

    console.log(`[/progress-review] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑥ 安全管理 /safety
  test("06_safety /safety — 安全管理ページ表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/safety");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページが404でないことを確認
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("ページが見つかりません");

    // デスクトップSS
    await screenshotFull(page, "safety-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "safety-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // 安全管理固有UI（タブ等）
    await expect(page.locator("text=チェックリスト")).toBeVisible({ timeout: 10000 });

    console.log(`[/safety] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑦ テンプレートライブラリ /phase-templates
  test("07_phase_templates /phase-templates — テンプレートライブラリ表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/phase-templates");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ページが404でないことを確認
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("ページが見つかりません");

    // デスクトップSS
    await screenshotFull(page, "phase-templates-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "phase-templates-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // テンプレートライブラリ固有UI
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });

    console.log(`[/phase-templates] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑧ 協力会社 /contractors
  test("08_contractors /contractors — 協力会社一覧表示", async ({ page }) => {
    await seedLocalStorage(page);
    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/contractors");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // ローディング終了待機
    await expect(page.locator('[aria-label="読み込み中"]')).not.toBeVisible({ timeout: 10000 });

    // デスクトップSS
    await screenshotFull(page, "contractors-desktop.png");

    // モバイル
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await screenshotFull(page, "contractors-mobile.png");

    // 不正テキストチェック
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `不正テキスト検出: ${badTexts.join(", ")}`).toHaveLength(0);

    // SEEDデータの協力会社が表示されている
    await expect(page.locator("text=株式会社ラポルタ")).toBeVisible({ timeout: 5000 });

    console.log(`[/contractors] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑨ 空状態: contractors — データなし時
  test("09_contractors_empty — 空状態チェック(undefinedやNaN表示なし)", async ({ page }) => {
    // データなし状態でシード
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify([]));
      localStorage.setItem("genbahub:tasks", JSON.stringify([]));
      localStorage.setItem("genbahub:contractors", JSON.stringify([]));
    });

    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/contractors");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await screenshotFull(page, "contractors-empty.png");

    // "undefined"/"null"/"NaN" が表示されていない
    const badTexts = await checkNoBadText(page);
    expect(badTexts, `空状態で不正テキスト: ${badTexts.join(", ")}`).toHaveLength(0);

    console.log(`[/contractors empty] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑩ 空状態: tasks — データなし時
  test("10_tasks_empty — 空状態チェック(undefinedやNaN表示なし)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify([]));
      localStorage.setItem("genbahub:tasks", JSON.stringify([]));
      localStorage.setItem("genbahub:contractors", JSON.stringify([]));
    });

    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/tasks");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await screenshotFull(page, "tasks-empty.png");

    const badTexts = await checkNoBadText(page);
    expect(badTexts, `空状態で不正テキスト: ${badTexts.join(", ")}`).toHaveLength(0);

    console.log(`[/tasks empty] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑪ 空状態: /app — データなし時
  test("11_dashboard_empty — 空状態チェック(undefinedやNaN表示なし)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify([]));
      localStorage.setItem("genbahub:tasks", JSON.stringify([]));
      localStorage.setItem("genbahub:contractors", JSON.stringify([]));
    });

    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/app");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await screenshotFull(page, "dashboard-empty.png");

    const badTexts = await checkNoBadText(page);
    expect(badTexts, `空状態で不正テキスト: ${badTexts.join(", ")}`).toHaveLength(0);

    console.log(`[/app empty] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });

  // ⑫ 進捗レビュー — 空状態
  test("12_progress_review_empty — 空状態チェック", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify([]));
      localStorage.setItem("genbahub:tasks", JSON.stringify([]));
      localStorage.setItem("genbahub:contractors", JSON.stringify([]));
    });

    const { errors, warns } = collectConsoleErrors(page);

    await page.goto("http://localhost:5173/#/progress-review");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await screenshotFull(page, "progress-review-empty.png");

    const badTexts = await checkNoBadText(page);
    expect(badTexts, `空状態で不正テキスト: ${badTexts.join(", ")}`).toHaveLength(0);

    console.log(`[/progress-review empty] errors=${JSON.stringify(errors)}, warns=${JSON.stringify(warns)}`);
  });
});
