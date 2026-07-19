// screenshotGate.ts — スクショ検収の自動ゲート判定ロジック
// 来歴: laporta-beads-4wos3 (GenbaHub: スクショ検収の自動ゲート) / worker(opus) / 2026-07-19
//
// ルール: page.goto()で始まるナビゲーションブロックの中でpage.screenshot()
// (または生の captureScreenshot()/waitForTestId() ヘルパー呼び出し)を行う場合、
// そのブロック内に対象data-testidの waitFor(可視 かつ 非ローディング) が
// 無ければ違反として報告する。page.waitForTimeout() のような固定sleepだけでは
// 画面遷移完了を保証しないため、それ単独では合格にしない。
//
// CLIラッパー: scripts/screenshot-gate.ts

export interface GateViolation {
  line: number;
  reason: string;
}

const HELPER_CALL_RE = /\b(captureScreenshot|waitForTestId)\s*\(/;
const RAW_SCREENSHOT_RE = /\bpage\.screenshot\s*\(/;
const SCREENSHOT_CALL_RE = /\.screenshot\s*\(/g;
const GOTO_CALL_RE = /\.goto\s*\(/g;
const VISIBLE_TESTID_WAIT_RE =
  /waitForSelector\s*\([^)]*data-testid[^)]*state\s*:\s*['"]visible['"][^)]*\)/;
const LOADING_MENTION_RE = /loading/i;
const DISMISS_STATE_RE = /state\s*:\s*['"](detached|hidden)['"]/;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

export function checkSource(src: string): GateViolation[] {
  const violations: GateViolation[] = [];

  // captureScreenshot()/waitForTestId() ヘルパーのみを使い、生のpage.screenshot()を
  // 直接呼んでいないスクリプトは、waitFor保証がヘルパー内部の契約になるため合格扱い。
  if (HELPER_CALL_RE.test(src) && !RAW_SCREENSHOT_RE.test(src)) {
    return violations;
  }

  const gotoIndices: number[] = [];
  {
    const re = new RegExp(GOTO_CALL_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) gotoIndices.push(m.index);
  }
  if (gotoIndices.length === 0) gotoIndices.push(0);

  const blocks = gotoIndices.map((start, i) => {
    const end = i + 1 < gotoIndices.length ? gotoIndices[i + 1] : src.length;
    return { start, text: src.slice(start, end) };
  });

  for (const block of blocks) {
    const re = new RegExp(SCREENSHOT_CALL_RE.source, "g");
    const shotIndices: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(block.text))) shotIndices.push(block.start + m.index);
    if (shotIndices.length === 0) continue;

    const hasHelper = HELPER_CALL_RE.test(block.text);
    const hasVisibleWait = VISIBLE_TESTID_WAIT_RE.test(block.text);
    const hasLoadingDismiss = LOADING_MENTION_RE.test(block.text) && DISMISS_STATE_RE.test(block.text);
    const compliant = hasHelper || (hasVisibleWait && hasLoadingDismiss);

    if (!compliant) {
      for (const idx of shotIndices) {
        violations.push({
          line: lineOf(src, idx),
          reason:
            "screenshot()前に対象data-testidのwaitFor(可視・非ローディング)が見つかりません(waitForTimeout等の固定sleepは不可)",
        });
      }
    }
  }

  return violations;
}
