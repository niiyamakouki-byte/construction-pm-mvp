/**
 * GenbaHub medium/low fixes bead 87di3 — real-browser regression evidence.
 * Base commit: 7d89cb5. Author: Codex.
 */
import { expect, test, type Page } from "@playwright/test";

const EVIDENCE_DIR = "tasks/87di3-verify/after";

async function prepare(page: Page, onboardingDone = true) {
  await page.addInitScript((done) => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.clear();
    sessionStorage.clear();
    if (done) localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
  }, onboardingDone);
}

async function openManualEstimate(page: Page) {
  await page.goto("/#/estimate");
  await page.getByRole("button", { name: /品目追加/ }).click();
  await page.getByRole("button", { name: /解体・撤去/ }).click();
  await page.getByRole("button", { name: /内装解体（木造）/ }).click();
}

test.describe("bead 87di3 regressions", () => {
  test("#5 数量を空にしても見積明細を黙って削除しない", async ({ page }) => {
    await prepare(page);
    await openManualEstimate(page);
    const selected = page.getByRole("listitem").filter({ hasText: "内装解体（木造）" });
    const quantity = selected.getByRole("spinbutton");

    await quantity.fill("");

    await expect(page.getByText("選択済み品目 (1件)")).toBeVisible();
    await expect(quantity).toHaveValue("0");
    await expect(selected.getByRole("button", { name: "内装解体（木造）を削除" })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE_DIR}/05-estimate-empty-quantity-retained.png`, fullPage: true });
  });

  test("#6 見積バリデーションを生成ボタン近傍の画面内に表示する", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await prepare(page);
    await openManualEstimate(page);
    const button = page.getByRole("button", { name: "見積書を生成" });

    await button.click();

    const alert = page.getByRole("alert");
    await expect(alert).toHaveText("物件名を入力してください");
    await expect(alert).toBeInViewport();
    const [buttonBox, alertBox] = await Promise.all([button.boundingBox(), alert.boundingBox()]);
    expect(buttonBox).not.toBeNull();
    expect(alertBox).not.toBeNull();
    expect(Math.abs(alertBox!.y - (buttonBox!.y + buttonBox!.height))).toBeLessThan(120);
    await page.screenshot({ path: `${EVIDENCE_DIR}/06-estimate-inline-validation.png` });
  });

  test("#7 /invoices のReact render中state update警告がない", async ({ page }) => {
    await prepare(page);
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));

    await page.goto("/#/invoices");
    await expect(page.getByRole("heading", { name: "請求書管理" })).toBeVisible();
    await page.waitForTimeout(300);

    expect(consoleMessages.filter((message) => /cannot update|while rendering|state update/i.test(message))).toEqual([]);
    await page.screenshot({ path: `${EVIDENCE_DIR}/07-invoices-no-render-warning.png`, fullPage: true });
  });

  test("#8 初回サンプル案件を競合して二重生成しない", async ({ page }) => {
    await prepare(page, false);

    await page.goto("/#/app");
    await expect(page).toHaveURL(/#\/gantt\//);
    const projects = await page.evaluate(() => JSON.parse(localStorage.getItem("genbahub:projects") ?? "[]"));

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toContain("サンプル");
    await page.screenshot({ path: `${EVIDENCE_DIR}/08-single-first-run-project.png`, fullPage: true });
  });
});
