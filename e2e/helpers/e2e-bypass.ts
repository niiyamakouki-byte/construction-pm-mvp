import type { Page } from "@playwright/test";

/**
 * window.__E2E_BYPASS_AUTH__ = true をReact読み込み前に注入し、AuthGuardの認証チェックをバイパスする。
 * laporta-beads-4ktwu: 18ファイルに個別定義されていた同一ボイラープレートをここへ集約。
 */
export async function bypassAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
  });
}

/**
 * bypassAuth に加え、localStorage を seed のキー・値でシードする(1回のaddInitScriptで注入)。
 * 値が文字列でなければ JSON.stringify する(genbahub:projects 等の配列/オブジェクトをそのまま渡せる)。
 */
export async function bypassAuthWithSeed(
  page: Page,
  seed: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript((data: Record<string, unknown>) => {
    (window as unknown as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ = true;
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, seed);
}
