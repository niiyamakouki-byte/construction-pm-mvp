import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditAdapters, isE2EAware, isSelfRoutingSupabaseAdapter } from "./audit-adapter-e2e-bypass.mjs";

const ROOT = path.resolve(__dirname, "..");

function readAtRev(rev: string, file: string): string {
  return execFileSync("git", ["show", `${rev}:${file}`], { cwd: ROOT, encoding: "utf8" });
}

// friction 2363cf8efc03: FreeeRepository.ts は他アダプタ(createAppRepository経由)と違い
// isSupabaseEnabled()のみでE2Eバイパスを見ない独自パターンを持ち、初回セッションで
// 生のSupabaseスキーマエラーに詰んでいた(検証ループ3周目 2026-07-30発見・584095dで修正)。
const FIX_COMMIT = "584095d";
const FIX_FILE = "src/lib/freee/FreeeRepository.ts";

describe("audit-adapter-e2e-bypass: FreeeRepository型の抜け穴(2363cf8efc03)", () => {
  it(`${FIX_FILE}: 修正前(${FIX_COMMIT}~1)は非準拠として検出される`, () => {
    const before = readAtRev(`${FIX_COMMIT}~1`, FIX_FILE);
    expect(isSelfRoutingSupabaseAdapter(before)).toBe(true);
    expect(isE2EAware(before)).toBe(false);
  });

  it(`${FIX_FILE}: 現在のツリーは準拠(緑)`, () => {
    const results = auditAdapters(path.join(ROOT, "src/lib"));
    const freee = results.find((r) => r.file.endsWith(FIX_FILE));
    expect(freee).toBeDefined();
    expect(freee!.compliant).toBe(true);
  });
});

// 実測(2026-07-30時点): 旧22件の負債(src/lib/supabase-adapter/* + create-repository.ts)は
// construction_pm_mvp-9ay で isE2EBypass() 準拠を展開し、ベースラインを0にした。
// 「既知の負債を再増加させない」ラチェット方式は維持する: 新規ファイルが非準拠で
// 見つかったら失敗させる。
const KNOWN_NONCOMPLIANT_BASELINE: string[] = [];

describe("audit-adapter-e2e-bypass: 新規の非準拠アダプタを増やさない(ラチェット)", () => {
  it("非準拠アダプタは既知の負債リストの範囲内に留まる", () => {
    const results = auditAdapters(path.join(ROOT, "src/lib"));
    const nonCompliant = results.filter((r) => !r.compliant).map((r) => path.relative(ROOT, r.file));
    const unexpected = nonCompliant.filter((f) => !KNOWN_NONCOMPLIANT_BASELINE.includes(f));
    expect(unexpected).toEqual([]);
  });
});
