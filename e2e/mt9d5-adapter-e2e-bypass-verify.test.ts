import { test, expect, type Page } from "@playwright/test";

// construction_pm_mvp-9ay: 旧22アダプタ(src/lib/supabase-adapter/* + create-repository.ts)へ
// isE2EBypass()準拠を展開した回帰チェック。FreeeRepository(584095d)修正前と同じ穴を持っていた
// 代表3ルート(CRMRepository/ProcurementRepository/OrderRepository)を初回セッション直行で
// 実走し、VITE_USE_SUPABASE=true(.env.local既定)でもconsoleに生Supabaseエラーが出ないことを見る。
async function bypassAuth(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
}

const ROUTES = [
  { path: "/crm", adapter: "CRMRepository" },
  { path: "/procurement", adapter: "ProcurementRepository" },
  { path: "/orders", adapter: "OrderRepository" },
];

test.describe("mt9d5: 旧アダプタのE2Eバイパス回帰(構築先行3ルート)", () => {
  for (const { path, adapter } of ROUTES) {
    test(`${path}(${adapter}): 初回セッション直行で本番Supabaseへネットワークリクエストを送らない`, async ({ page }) => {
      await bypassAuth(page);
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const supabaseRequests: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("request", (req) => {
        if (/\.supabase\.co\//.test(req.url())) supabaseRequests.push(req.url());
      });

      await page.goto(`/#${path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      // isE2EBypass()準拠前は、この時点で customers/procurement_materials/purchase_orders 等の
      // テーブルへ実Supabaseリクエストが飛んでいた(本番DBへ接触・E2Eバイパスの意味が壊れる)。
      expect(supabaseRequests, `${path}: 本番Supabaseへのリクエスト検出 ${JSON.stringify(supabaseRequests)}`).toHaveLength(0);

      const supabaseErrors = [...consoleErrors, ...pageErrors].filter((m) =>
        /supabase|schema cache|Could not find the table/i.test(m),
      );
      expect(supabaseErrors, `${path}: 生Supabaseエラー検出 ${JSON.stringify(supabaseErrors)}`).toHaveLength(0);

      const bodyText = await page.locator("#root").innerText();
      expect(bodyText.trim().length, `${path}: #root が空(白画面)`).toBeGreaterThan(0);
    });
  }
});
