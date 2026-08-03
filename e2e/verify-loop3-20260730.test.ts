import { test, expect, type Page } from "@playwright/test";
import { bypassAuth } from "./helpers/e2e-bypass.js";

// 検証ループ 2026-07-30 3周目: 「深リンク×初回セッション空状態」を全ルート網羅で検証する。
// 2周目(4455c56)で /reports の詰みバグ(l4u47)を発見・修正した同族バグの一括検出。
// 各ルートへ localStorage 完全空の状態(初回セッション)で直接遷移し、
// (a) 白画面/JSエラーがないか (b) 恒久disabledで詰んでいないか (c) 復帰導線があるかを見る。

// AuthGuard配下でauthLoading/組織コンテキスト初期化を待つための共通待機。
async function gotoFirstRun(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  // レイアウト確定・非同期state反映を待つ小さな猶予(スピナー残留対策)
  await page.waitForTimeout(300);
}

// src/App.tsx の `route === "/xxx"` 静的ルート一覧から、認証必須かつ案件データに
// 依存しうるアプリ内ルートのみを対象にする(ランディング/ログイン/課金系は対象外)。
const ROUTES = [
  "/app",
  "/today",
  "/gantt",
  "/tasks",
  "/cost-management",
  "/invoice",
  "/invoices",
  "/invoices/reconcile",
  "/estimate",
  "/takeoff",
  "/contractors",
  "/notifications",
  "/help",
  "/crm",
  "/reports",
  "/finishing",
  "/schedule",
  "/phase-templates",
  "/photos",
  "/weather",
  "/safety",
  "/procurement",
  "/orders",
  "/cross-project-gantt",
  "/progress-review",
  "/resource-analysis",
  "/account",
  "/node-schedule",
  "/cards",
  "/margin-watch",
  "/profit-ranking",
  "/crew-optimizer",
  "/repeat-predictor",
  "/inquiry-responder",
  "/sales-pipeline",
  "/proposal-generator",
  "/meeting-runner",
  "/change-order",
  "/handover-package",
  "/owner-suggestion",
  "/site-livestream",
  "/owner-ambassador",
  "/longterm-followup",
  "/local-seo",
  "/insurance-assessment",
];

test.describe("検証ループ3周目: 深リンク×初回セッション空状態 全ルート網羅", () => {
  for (const route of ROUTES) {
    test(`${route} に初回セッションで直接遷移してもJSエラー・白画面・恒久disabledで詰まない`, async ({ page }) => {
      await bypassAuth(page);
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await gotoFirstRun(page, `/#${route}`);

      // 白画面(bodyがほぼ空)になっていないこと。#root配下に可視テキストがあるはず。
      const bodyText = await page.locator("#root").innerText();
      expect(bodyText.trim().length, `${route}: #root が空(白画面)`).toBeGreaterThan(0);

      // 汎用404("ページが見つかりません")に落ちていないこと(ルート定義漏れ検知)。
      expect(bodyText, `${route}: 汎用404に落ちている`).not.toContain("ページが見つかりません");

      // JSエラーが出ていないこと。
      expect(errors, `${route}: pageerror発生 ${JSON.stringify(errors)}`).toHaveLength(0);

      await page.screenshot({
        path: `e2e/screenshots/loop3-${route.replace(/\//g, "_")}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("検証ループ3周目: /schedule 案件0件の行き詰まりを修正", () => {
  test("案件0件の状態で直接遷移すると案件登録への導線が出る", async ({ page }) => {
    await bypassAuth(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoFirstRun(page, "/#/schedule");

    await expect(page.getByText("案件がまだありません")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "案件を登録する" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#\/(app|gantt)/);

    expect(errors).toHaveLength(0);
  });
});

test.describe("laporta-beads-mt9d5: /invoices/reconcile の生Supabaseエラーを修正", () => {
  test("初回セッション直接遷移で生のSupabaseスキーマエラーに詰まらず通常の照合画面が開く", async ({ page }) => {
    await bypassAuth(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoFirstRun(page, "/#/invoices/reconcile");

    // FreeeRepositoryがE2Eバイパス中は実Supabaseへ問い合わせないため、
    // 「再読み込み」を押しても解消しない詰みだった生エラー文言が出ないこと
    const bodyText = await page.locator("#root").innerText();
    expect(bodyText).not.toContain("Could not find the table");
    expect(bodyText).not.toContain("schema cache");

    // 生エラー画面(「再読み込み」ボタンのみの詰み)ではなく通常の照合画面が開くこと
    await expect(page.getByRole("heading", { name: "入金照合", exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /freee 同期/ })).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
