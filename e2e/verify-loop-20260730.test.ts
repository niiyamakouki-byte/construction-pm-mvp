import { test, expect, type Page } from "@playwright/test";

// 検証ループ 2026-07-30: 案件作成→タスク→原価登録、CRM検索、ドキュメント検索の3本を実走。
// Same auth-bypass pattern as happy-path.test.ts / authenticated-pages.test.ts.
async function bypassAuth(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
}

async function openProjectList(page: Page) {
  await page.goto("/#/app");
  await page.waitForLoadState("networkidle");
  // /app may redirect straight into the last-viewed project; use the sidebar nav to force the list.
  const navItem = page.locator("text=案件一覧").first();
  if (await navItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await navItem.click();
    await page.waitForLoadState("networkidle");
  }
}

test.describe("検証ループ: 案件作成 → タスク → 原価登録", () => {
  test("新規案件を作成し、タスクと実行予算を登録できる", async ({ page }) => {
    await bypassAuth(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const projectName = `検証ループ案件-${Date.now()}`;

    await openProjectList(page);
    await page.getByRole("button", { name: "新規案件" }).click();
    await page.locator("#project-name").fill(projectName);
    await page.getByRole("button", { name: "作成", exact: true }).click();

    await expect(page.getByText(`「${projectName}」を登録しました`)).toBeVisible({ timeout: 10000 });

    await openProjectList(page);
    // Each project card is a single clickable role="button" div containing the project name.
    await page.getByRole("button").filter({ hasText: projectName }).click();
    await page.waitForLoadState("networkidle");

    // タスク追加
    await page.locator("button", { hasText: "タスク追加" }).first().click();
    await page.getByLabel("タスク名").fill("検証タスクA");
    await page.getByRole("button", { name: "タスクを追加", exact: true }).click();
    await expect(page.getByText("検証タスクA").first()).toBeVisible({ timeout: 5000 });

    // 収支タブ → 実行予算(原価)登録
    await page.getByRole("button", { name: "収支", exact: true }).click();
    await page.getByPlaceholder("カテゴリ (例: 内装)").fill("検証カテゴリ");
    await page.getByPlaceholder("予算額").fill("100000");
    await page.getByRole("button", { name: "追加" }).nth(1).click();
    await expect(page.getByText("検証カテゴリ")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("￥0 / ￥100,000")).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe("検証ループ: CRM検索", () => {
  test("該当なしクエリで適切な空状態メッセージが出る", async ({ page }) => {
    await bypassAuth(page);
    await page.goto("/#/crm");
    await page.waitForLoadState("networkidle");
    await page.getByText("顧客一覧").first().click();

    const searchBox = page.getByPlaceholder("顧客検索（名前・会社・メール）");
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.fill("存在しない顧客名XYZ123");
    await expect(page.getByText("顧客が見つかりません")).toBeVisible({ timeout: 5000 });
  });
});
