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

// 実測(2026-07-30時点): src/lib配下には FreeeRepository.ts と同型の抜け穴(isE2EBypass無し)を持つ
// レガシーアダプタが22件、修正前から既に存在する(src/lib/supabase-adapter/* + create-repository.ts)。
// これらを一括修正するのは本票の範囲外(監査スクリプトの新設のみが依頼範囲)なので、
// 「既知の負債を再増加させない」ラチェット方式で回帰を防ぐ: このリストに無い新規ファイルが
// 非準拠で見つかったら失敗させる。負債を返したらこの配列からファイル名を削除すること。
const KNOWN_NONCOMPLIANT_BASELINE = [
  "src/lib/repository/create-repository.ts",
  "src/lib/supabase-adapter/CRMRepository.ts",
  "src/lib/supabase-adapter/ChatRepository.ts",
  "src/lib/supabase-adapter/ClaimRepository.ts",
  "src/lib/supabase-adapter/ComplianceRepository.ts",
  "src/lib/supabase-adapter/ContractorRepository.ts",
  "src/lib/supabase-adapter/EquipmentRepository.ts",
  "src/lib/supabase-adapter/InvoiceRepository.ts",
  "src/lib/supabase-adapter/LaborRepository.ts",
  "src/lib/supabase-adapter/MeetingRepository.ts",
  "src/lib/supabase-adapter/MoodBoardRepository.ts",
  "src/lib/supabase-adapter/OrderRepository.ts",
  "src/lib/supabase-adapter/PermitRepository.ts",
  "src/lib/supabase-adapter/PhaseRepository.ts",
  "src/lib/supabase-adapter/ProcurementRepository.ts",
  "src/lib/supabase-adapter/ProjectRepository.ts",
  "src/lib/supabase-adapter/PunchListRepository.ts",
  "src/lib/supabase-adapter/SafetyRepository.ts",
  "src/lib/supabase-adapter/SelectionRepository.ts",
  "src/lib/supabase-adapter/SiteEntryRepository.ts",
  "src/lib/supabase-adapter/TaskRepository.ts",
  "src/lib/supabase-adapter/WarrantyRepository.ts",
];

describe("audit-adapter-e2e-bypass: 新規の非準拠アダプタを増やさない(ラチェット)", () => {
  it("非準拠アダプタは既知の負債リストの範囲内に留まる", () => {
    const results = auditAdapters(path.join(ROOT, "src/lib"));
    const nonCompliant = results.filter((r) => !r.compliant).map((r) => path.relative(ROOT, r.file));
    const unexpected = nonCompliant.filter((f) => !KNOWN_NONCOMPLIANT_BASELINE.includes(f));
    expect(unexpected).toEqual([]);
  });
});
