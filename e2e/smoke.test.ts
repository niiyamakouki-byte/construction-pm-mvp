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
  // メールアドレス入力欄
  await expect(page.locator('input[type="email"]')).toBeVisible();
  // パスワード入力欄
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // ログインボタン
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("Supabase未設定時はAuthGuardをスキップしてダッシュボードが表示される", async ({ page }) => {
  // Supabase env が未設定の場合、AuthGuard は children をそのまま返す
  // その状態で /#/app にアクセスするとプロジェクト一覧ページが表示される
  await page.goto("/#/app");
  // GenbaHub ヘッダーが見える
  await expect(page.locator("text=GenbaHub")).toBeVisible();
  // ボトムナビまたはメインナビが存在する
  await expect(page.locator("nav")).toBeVisible();
});
