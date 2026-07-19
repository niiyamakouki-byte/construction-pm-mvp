# スクショ検収ルール(data-testid waitFor必須)

来歴: laporta-beads-4wos3 (GenbaHub: スクショ検収の自動ゲート) / worker(opus) / 2026-07-19

## Before / After

- **Before**: 完了報告のスクショが画面遷移途中やローディング中の状態を撮ってしまい、検収官が目視でしか気づけない。
- **After**: スクショ撮影スクリプトは対象data-testidのwaitFor(可視・非ローディング)を必須とし、省略したスクリプトは自動ゲートで検収NGにする。

## ルール

`page.screenshot()` を呼ぶ全てのスクリプトは、各 `page.goto()` ブロック内で screenshot を撮る前に、対象画面が

1. **可視** (`waitForSelector('[data-testid="..."]', { state: "visible" })` 相当) かつ
2. **非ローディング** (ローディング表示用要素が `detached`/`hidden` になるまで待つ)

であることを保証しなければならない。`page.waitForTimeout(ms)` のような固定sleepのみでは合格にしない(ネットワーク/CPU負荷で遅延時間は変動し、遷移完了を保証しないため — 実際に `tasks/landing-screenshot.mjs` や `e2e/prod-verify.mjs` はこのパターンで書かれている)。

## 実装方法

- 新規スクリプトは `tasks/_template-screenshot.mjs` をコピーして使う。
- `tasks/lib/screenshot-guard.mjs` の `captureScreenshot(page, outPath, { testId })` を経由すればルールを自動的に満たす(内部で `waitForTestId()` を呼ぶ)。
- 生の `page.screenshot()` を直接使いたい場合は、直前に `page.waitForSelector('[data-testid="..."]', { state: "visible" })` と、ローディング要素に対する `state: "detached"`/`"hidden"` の待機を両方書くこと。

## 自動ゲート

```
node --experimental-strip-types scripts/screenshot-gate.ts <file.mjs> [file2.mjs ...]
node --experimental-strip-types scripts/screenshot-gate.ts --dir tasks
```

exit 0 = 全ファイル合格。exit 1 = 1件以上NG(該当行番号と理由をstdoutに列挙)。判定ロジックは `src/lib/screenshotGate.ts`(単体テスト: `src/lib/screenshotGate.test.ts`、`pnpm test` に含まれる)。

**運用ルール**: 完了報告に添付するスクショ撮影スクリプトは、報告前に上記ゲートを通し `RESULT: PASS` を確認すること。NGのまま提出されたスクショは検収NGとして差し戻す。
