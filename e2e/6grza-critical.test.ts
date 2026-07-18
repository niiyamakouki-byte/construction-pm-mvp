/**
 * GenbaHub Critical修正 bead 6grza — 反証監査3手順の実ブラウザ回帰検証。
 * Author: Codex
 */
import { expect, test, type Page } from "@playwright/test";

const EVIDENCE_DIR = "tasks/6grza-verify";

async function prepare(page: Page, projects?: unknown[]) {
  await page.addInitScript((seedProjects) => {
    window.__E2E_BYPASS_AUTH__ = true;
    if (sessionStorage.getItem("__6grza_prepared__") === "1") return;
    sessionStorage.setItem("__6grza_prepared__", "1");
    localStorage.clear();
    localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
    if (seedProjects) {
      localStorage.setItem("genbahub:projects", JSON.stringify(seedProjects));
    }
  }, projects);
}

async function closeSidebar(page: Page) {
  const closeButton = page.getByRole("button", { name: "サイドバーを閉じる" });
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

test.describe("bead 6grza critical/high regressions", () => {
  test("startDate欠損案件でも /today がクラッシュしない", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await prepare(page, [{
        id: "11111111-1111-1111-1111-111111111111",
        name: "開始日欠損案件",
        description: "",
        status: "active",
        mode: "normal",
        includeWeekends: false,
        createdAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
      }]);

    await page.goto("/#/today");
    await expect(page.getByRole("button", { name: "案件を作成する", exact: true })).toBeVisible();
    await closeSidebar(page);
    await expect(page.getByText("Invalid time value")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: `${EVIDENCE_DIR}/01-today-missing-start-date.png`, fullPage: true });
  });

  test("localStorage空から作ったデモ案件の挨拶に固定名が出ない", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await prepare(page);

    await page.goto("/#/today");
    await page.getByRole("button", { name: "デモデータで試す" }).click();
    await expect(page).toHaveURL(/#\/gantt\//);
    await page.goto("/#/today");
    await closeSidebar(page);
    const greeting = page.locator("p.font-bold.text-brand-800").first();
    await expect(greeting).toBeVisible();
    await expect(greeting).not.toContainText("光輝さん");
    await expect(greeting).not.toContainText("、");
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: `${EVIDENCE_DIR}/02-today-no-profile-name.png`, fullPage: true });
  });

  test("/sales-pipeline がサンプルを明示し空状態へ移行できる", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await prepare(page);

    await page.goto("/#/sales-pipeline");
    await closeSidebar(page);
    await expect(page.getByText("サンプルデータ", { exact: true })).toBeVisible();
    await expect(page.getByText("操作体験用の架空の商談です")).toBeVisible();
    await expect(page.getByRole("button", { name: "空状態から始める" })).toBeVisible();
    await expect(page.getByText("新山光輝")).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCE_DIR}/03-sales-pipeline-sample-badge.png`, fullPage: true });

    await page.getByRole("button", { name: "空状態から始める" }).click();
    await expect(page.getByText("サンプルデータ", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("サンプルデータ", { exact: true })).toHaveCount(0);
    await expect(page.getByText("総商談数").locator("..")).toContainText("0件");
    expect(await page.evaluate(() => ({
      deals: localStorage.getItem("laporta.genbahub.deals"),
      sampleState: localStorage.getItem("laporta.genbahub.deals.sample-state"),
    }))).toEqual({ deals: "[]", sampleState: "dismissed" });
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: `${EVIDENCE_DIR}/04-sales-pipeline-empty.png`, fullPage: true, animations: "disabled" });
  });
});
