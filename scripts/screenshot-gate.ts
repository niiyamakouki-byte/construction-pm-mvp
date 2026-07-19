#!/usr/bin/env -S node --experimental-strip-types
// screenshot-gate.ts — スクショ検収の自動ゲート CLI
// 来歴: laporta-beads-4wos3 (GenbaHub: スクショ検収の自動ゲート) / worker(opus) / 2026-07-19
//
// 判定ロジックは src/lib/screenshotGate.ts。ここは fs 読み込み+レポート出力のみ。
// import指定子は(このリポの他TS実行スクリプトの慣習".js"ではなく)明示".ts"を使う。
// 実測: node --experimental-strip-types はこのNode25環境で".js"→".ts"解決をしない
// (src/api/server.ts 等の既存".js" import自体もこの環境ではERR_MODULE_NOT_FOUNDになる)。
//
// usage:
//   node --experimental-strip-types scripts/screenshot-gate.ts <file.mjs> [file2.mjs ...]
//   node --experimental-strip-types scripts/screenshot-gate.ts --dir tasks
//
// exit 0 = 全ファイルOK(検収可), exit 1 = 1件以上NG(検収NG)

import fs from "node:fs";
import path from "node:path";
import { checkSource } from "../src/lib/screenshotGate.ts";

function collectFiles(args: string[]): string[] {
  if (args[0] === "--dir") {
    const dir = args[1];
    if (!dir) {
      console.error("--dir requires a directory path");
      process.exit(2);
    }
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".mjs") || f.endsWith(".ts"))
      .map((f) => path.join(dir, f));
  }
  return args;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node --experimental-strip-types scripts/screenshot-gate.ts <file...> | --dir <dir>");
  process.exit(2);
}

const files = collectFiles(args);
let ngCount = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const violations = checkSource(src);
  if (violations.length === 0) {
    console.log(`OK   ${file}`);
  } else {
    ngCount++;
    console.log(`NG   ${file}`);
    for (const v of violations) {
      console.log(`       L${v.line}: ${v.reason}`);
    }
  }
}

console.log("");
console.log(ngCount === 0 ? `RESULT: PASS (${files.length} files)` : `RESULT: FAIL (${ngCount}/${files.length} NG)`);
process.exit(ngCount === 0 ? 0 : 1);
