import { test, expect } from "@playwright/test";

test("トップページにアクセスできる", async ({ page }) => {
  await page.goto("/");
  // ルートは / → /app にリダイレクトされるが、ページ自体はロードされる
  await expect(page).toHaveTitle(/.+/);
  // 500エラーやクラッシュがないことを確認
  expect(page.url()).toContain("localhost:5173");
});

test("ログインフォームが表示される（AuthGuard）", async ({ page }) => {
  await page.goto("/#/login");
  // Google認証メインUIのため、メールフォームは開示ボタンの裏にある
  await page.getByRole("button", { name: "メールアドレスとパスワードでログイン" }).click();
  // メールアドレス入力欄（#email で一意に特定）
  await expect(page.locator("#email")).toBeVisible();
  // パスワード入力欄
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // ログインボタン
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("アプリ入口がクラッシュせず表示される", async ({ page }) => {
  await page.goto("/#/app");
  await expect(page.locator("body")).toContainText("LapoSite");
});
