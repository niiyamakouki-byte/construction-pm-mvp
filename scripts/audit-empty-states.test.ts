import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasUnguardedEmptyBranch } from "./audit-empty-states.mjs";

const ROOT = path.resolve(__dirname, "..");

function readAtRev(rev: string, file: string): string {
  return execFileSync("git", ["show", `${rev}:${file}`], { cwd: ROOT, encoding: "utf8" });
}

// friction f3cdfb8eeb89: reports/schedule/invoices-reconcile の3件は
// 「EmptyState未使用のまま0件/詰み分岐で行き詰まる」同族バグとして実際に人力発見・修正された。
// 修正コミットの親(修正前)では検出され、現在のツリー(修正後)では検出されないことを実測する。
const KNOWN_FIXES = [
  { file: "src/pages/ReportsPage.tsx", fixCommit: "4455c56" },
  { file: "src/pages/ScheduleFromEstimatePage.tsx", fixCommit: "bae4987" },
  { file: "src/pages/InvoiceReconcilePage.tsx", fixCommit: "584095d" },
];

describe("audit-empty-states: 既知の修正済み回帰(f3cdfb8eeb89)", () => {
  for (const { file, fixCommit } of KNOWN_FIXES) {
    it(`${file}: 修正前(${fixCommit}~1)は検出される`, () => {
      const before = readAtRev(`${fixCommit}~1`, file);
      expect(hasUnguardedEmptyBranch(before)).toBe(true);
    });

    it(`${file}: 現在のツリーは検出されない(緑)`, () => {
      const current = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(hasUnguardedEmptyBranch(current)).toBe(false);
    });
  }
});
