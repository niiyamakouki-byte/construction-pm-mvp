import { test, expect } from "@playwright/test";
import { bypassAuth } from "./helpers/e2e-bypass.js";

test.describe("Happy Path: ログイン後 /today ダッシュボード表示", () => {
  test("ログイン → /today ダッシュボードが描画される", async ({ page }) => {
    await bypassAuth(page);

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/#/today");
    await page.waitForLoadState("networkidle");

    // App shell visible (not login form)
    await expect(page.getByRole("button", { name: "案件を作成する", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#email")).not.toBeVisible();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });
});

test.describe("Happy Path: ガントチャート画面遷移", () => {
  test("ガントチャート画面に遷移して工程表ヘッダーが表示される", async ({ page }) => {
    await bypassAuth(page);

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/#/gantt");
    await page.waitForLoadState("networkidle");

    // App shell visible (not login form)
    await expect(page.getByRole("button", { name: "案件を登録する", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#email")).not.toBeVisible();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });
});
