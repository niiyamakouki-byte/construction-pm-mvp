// screenshot-guard.mjs — スクショ撮影前のwaitFor(可視・非ローディング)共有ヘルパー
// 来歴: laporta-beads-4wos3 (GenbaHub: スクショ検収の自動ゲート) / worker(opus) / 2026-07-19
//
// 完了報告のスクショが画面遷移途中/ローディング中を撮ってしまう事故を防ぐため、
// page.screenshot()を直接呼ばずこのcaptureScreenshot()を経由させる。
// scripts/screenshot-gate.ts はこの呼び出しパターン(または同等のwaitForSelector)が
// あるかを静的検査し、無いスクリプトを検収NGにする。

/**
 * 対象data-testidが可視になり、かつローディング表示(既定でdata-testid="loading")が
 * DOMから外れるまで待つ。
 */
export async function waitForTestId(page, testId, opts = {}) {
  const { timeout = 10000, loadingTestId = "loading", loadingSelector = null } = opts;
  const selector = `[data-testid="${testId}"]`;
  await page.waitForSelector(selector, { state: "visible", timeout });

  const loadingSel = loadingSelector ?? (loadingTestId ? `[data-testid="${loadingTestId}"]` : null);
  if (loadingSel) {
    const stillLoading = await page.$(loadingSel);
    if (stillLoading) {
      await page.waitForSelector(loadingSel, { state: "detached", timeout }).catch(() => {});
    }
  }
}

/**
 * waitForTestId()で可視・非ローディングを保証してからpage.screenshot()する。
 * testIdは必須(waitForを省略できないようにするための強制引数)。
 */
export async function captureScreenshot(page, outPath, opts = {}) {
  const { testId, loadingTestId, loadingSelector, fullPage = true, timeout, ...screenshotOpts } = opts;
  if (!testId) {
    throw new Error("captureScreenshot: testId is required (waitFor gate needs a target data-testid)");
  }
  await waitForTestId(page, testId, { loadingTestId, loadingSelector, timeout });
  await page.screenshot({ path: outPath, fullPage, ...screenshotOpts });
  return outPath;
}
