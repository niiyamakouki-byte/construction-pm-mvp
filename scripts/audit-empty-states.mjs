#!/usr/bin/env node
// friction f3cdfb8eeb89: ルート直下ページで「0件/失敗分岐はあるのにEmptyState導線が無い」まま
// 実装してしまう再発パターン(reports/schedule/invoices-reconcile同族, 3周連続で人力発見)を
// 静的に検出する。AST解析はコストが高いので、
//   「ページファイル」×「EmptyStateのimport有無」×「0件/詰み分岐キーワードの有無」
// のヒューリスティックで代替する。誤検知(過検出)は許容し、検出漏れの最小化を優先する。
import fs from 'node:fs';
import path from 'node:path';

// EmptyState を導入済みなら、そのページの0件分岐はもう機械検出対象外(=導線あり扱い)。
const EMPTY_STATE_IMPORT_RE = /from\s*["'][^"']*\/EmptyState(\.js)?["']/;

// 0件/詰み分岐キーワード。length===0系だけでなく、pageState==="error"のような
// 「データが無くてこの先レンダリングが続かない」分岐も同族として拾う。
const DEAD_END_BRANCH_PATTERNS = [
  /\.length\s*(===|==|<=|<)\s*0\b/,
  /!\s*[\w.]+\.length\b/,
  /===\s*["'](error|empty|not-provisioned)["']/,
];

export function hasUnguardedEmptyBranch(src) {
  if (EMPTY_STATE_IMPORT_RE.test(src)) return false;
  return DEAD_END_BRANCH_PATTERNS.some((re) => re.test(src));
}

// ルート直下ページコンポーネントのみ対象(src/pages/*.tsx、サブディレクトリ・*.test.tsxは除外)。
export function listPageFiles(pagesDir) {
  return fs
    .readdirSync(pagesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx'))
    .map((e) => path.join(pagesDir, e.name));
}

export function auditPagesDir(pagesDir) {
  return listPageFiles(pagesDir).map((file) => ({
    file,
    flagged: hasUnguardedEmptyBranch(fs.readFileSync(file, 'utf8')),
  }));
}

// CLI実行時のみ走査・レポートする(テストからはexportした関数を直接使う)。
if (import.meta.url === `file://${process.argv[1]}`) {
  const pagesDir = process.argv[2] ?? path.join(process.cwd(), 'src/pages');
  const results = auditPagesDir(pagesDir).filter((r) => r.flagged);
  for (const r of results) {
    console.log(`${r.file}: EmptyState未使用のまま0件/詰み分岐がある可能性`);
  }
  console.log(`TOTAL_FLAGGED=${results.length}`);
  process.exit(results.length === 0 ? 0 : 1);
}
