#!/usr/bin/env node
// friction 2363cf8efc03: FreeeRepository.ts が他アダプタ(createAppRepository経由)と違う
// 独自パターン(isSupabaseEnabled()のみでE2Eバイパスを見ない)を持っていたため、
// E2Eバイパス中(__E2E_BYPASS_AUTH__)でもVITE_USE_SUPABASE=trueなら実Supabaseへ問い合わせ、
// 初回セッションで生のスキーマエラーに詰んでいた(検証ループ3周目で発見・修正: 584095d)。
// 同型の抜け穴を持つファイルをsrc/lib配下から機械検出する。
//
// 「Supabaseアダプタ」の判定条件: VITE_USE_SUPABASE を読んで自前でSupabaseRepositoryを
// 生成する(=ルーティング判断を自分で持つ)ファイル。createAppRepository等の共有ファクトリ
// 経由でルーティングを委譲しているファイルはこの判断を持たないので対象外。
// 準拠条件: isE2EBypass / __E2E_BYPASS_AUTH__ への参照を持つこと。
import fs from 'node:fs';
import path from 'node:path';

export function isSelfRoutingSupabaseAdapter(src) {
  return src.includes('VITE_USE_SUPABASE') && /new\s+SupabaseRepository\b/.test(src);
}

export function isE2EAware(src) {
  return /isE2EBypass|__E2E_BYPASS_AUTH__/.test(src);
}

function walkTsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (e.isFile() && full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

// libDir配下の「自前ルーティングSupabaseアダプタ」だけを対象に準拠監査する。
export function auditAdapters(libDir) {
  return walkTsFiles(libDir)
    .map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }))
    .filter(({ src }) => isSelfRoutingSupabaseAdapter(src))
    // ponytail: file を POSIX 形式に正規化(Windows実行時はpath.joinがbackslashを返し、
    // 呼び出し側のFIX_FILE等 "/" 区切り定数との endsWith 比較が壊れるため)
    .map(({ file, src }) => ({ file: file.split(path.sep).join('/'), compliant: isE2EAware(src) }));
}

// CLI実行時のみ走査・レポートする(テストからはexportした関数を直接使う)。
if (import.meta.url === `file://${process.argv[1]}`) {
  const libDir = process.argv[2] ?? path.join(process.cwd(), 'src/lib');
  const results = auditAdapters(libDir).filter((r) => !r.compliant);
  for (const r of results) {
    console.log(`${r.file}: isE2EBypass/__E2E_BYPASS_AUTH__ 判定が無いSupabaseアダプタ`);
  }
  console.log(`TOTAL_NONCOMPLIANT=${results.length}`);
  process.exit(results.length === 0 ? 0 : 1);
}
