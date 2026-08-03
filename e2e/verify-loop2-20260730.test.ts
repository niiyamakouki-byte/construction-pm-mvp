import { test, expect, type Page } from "@playwright/test";
import { bypassAuth } from "./helpers/e2e-bypass.js";

// 検証ループ 2026-07-30 2周目: タスクステータス遷移(今日ダッシュボード)、CRM新規顧客登録、報告書(日報)プレビューの3本を実走。
// Same auth-bypass pattern as happy-path.test.ts / e2e/verify-loop-20260730.test.ts.

async function openProjectList(page: Page) {
  await page.goto("/#/app");
  await page.waitForLoadState("networkidle");
  // laporta-beads-e254a(2026-08-03)以降、新規ストレージの自動bootstrap成功直後はTourGuideの
  // フルスクリーンオーバーレイが出るため、サイドバー操作の前にスキップしておく。
  const tourSkip = page.getByText("スキップ", { exact: true });
  if (await tourSkip.isVisible({ timeout: 1000 }).catch(() => false)) {
    await tourSkip.click();
  }
  const navItem = page.locator("text=案件一覧").first();
  if (await navItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await navItem.click();
    await page.waitForLoadState("networkidle");
  }
}

async function localToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
}

test.describe("検証ループ2周目: タスクステータス遷移", () => {
  test("期限が今日のタスクを今日ダッシュボードで進行中→完了に遷移できる", async ({ page }) => {
    await bypassAuth(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const projectName = `検証2周目案件-${Date.now()}`;
    const taskName = "本日期限タスクA";

    await openProjectList(page);
    await page.getByRole("button", { name: "新規案件" }).click();
    await page.locator("#project-name").fill(projectName);
    await page.getByRole("button", { name: "作成", exact: true }).click();
    await expect(page.getByText(`「${projectName}」を登録しました`)).toBeVisible({ timeout: 10000 });

    await openProjectList(page);
    await page.getByRole("button").filter({ hasText: projectName }).click();
    await page.waitForLoadState("networkidle");

    const today = await localToday(page);

    await page.locator("button", { hasText: "タスク追加" }).first().click();
    await page.getByLabel("タスク名").fill(taskName);
    await page.getByLabel("終了日").fill(today);
    await page.getByRole("button", { name: "タスクを追加", exact: true }).click();
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 5000 });

    // 今日ダッシュボードへ移動し、期限=今日のタスクとして表示されることを確認
    await page.goto("/#/today");
    await page.waitForLoadState("networkidle");

    const taskCard = page.locator("li", { hasText: taskName });
    await expect(taskCard).toBeVisible({ timeout: 10000 });
    await expect(taskCard.getByText("未着手")).toBeVisible();

    await taskCard.getByRole("button", { name: "◉ 進行中" }).click();
    await expect(taskCard.getByText("進行中")).toBeVisible({ timeout: 5000 });

    await taskCard.getByRole("button", { name: "✓ 完了" }).click();
    // 完了に遷移すると today ダッシュボードの「今日のタスク」対象外になり、カード自体が消える
    await expect(page.locator("li", { hasText: taskName })).toHaveCount(0, { timeout: 5000 });

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("検証ループ2周目: CRM新規顧客登録", () => {
  test("商談フォームから新規顧客を登録すると顧客一覧に反映される", async ({ page }) => {
    await bypassAuth(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const customerName = `検証顧客-${Date.now()}`;

    await page.goto("/#/crm");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "+ 商談追加" }).click();
    await page.getByRole("button", { name: "+顧客" }).click();
    await page.getByPlaceholder("氏名 *").fill(customerName);
    await page.getByPlaceholder("会社名").fill("検証工業株式会社");
    await page.getByRole("button", { name: "顧客を登録" }).click();

    await page.getByRole("button", { name: "顧客一覧" }).click();
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 5000 });

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("検証ループ2周目: 報告書(日報)プレビュー", () => {
  test("案件を選び日報プレビューを生成できる", async ({ page }) => {
    await bypassAuth(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // /app を経由して初回サンプル案件のシードを済ませてから /reports へ入る
    // (直接 /reports へ遷移すると発見#l4u47の通り案件0件のまま行き詰まるため)
    await openProjectList(page);

    await page.goto("/#/reports");
    await page.waitForLoadState("networkidle");

    const projectSelect = page.locator("#report-project");
    await expect(projectSelect).toBeVisible({ timeout: 5000 });
    await expect(projectSelect.locator("option")).not.toHaveCount(0);

    await page.getByRole("button", { name: "プレビュー" }).click();
    await expect(page.getByTitle("報告書プレビュー")).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toHaveLength(0);
  });

  test("案件0件の状態で直接遷移すると案件登録への導線が出る(#l4u47)", async ({ page }) => {
    await bypassAuth(page);

    await page.goto("/#/reports");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("案件がまだありません")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "案件を登録する" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#\/(app|gantt)/);
  });
});
