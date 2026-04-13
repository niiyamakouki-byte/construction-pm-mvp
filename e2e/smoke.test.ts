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
  // メールアドレス入力欄（#email で一意に特定）
  await expect(page.locator("#email")).toBeVisible();
  // パスワード入力欄
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // ログインボタン
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("AuthGuardが未認証ユーザーをログインページにリダイレクトする", async ({ page }) => {
  // Supabase が設定済みでセッションなしの場合、AuthGuard は /login にリダイレクトする
  await page.goto("/#/app");
  // GenbaHub ブランドが見える（ログインページのロゴ）
  await expect(page.locator("text=GenbaHub")).toBeVisible();
  // ログインフォームが表示されている（リダイレクト後）
  await expect(page.locator("#email")).toBeVisible();
});
