#!/usr/bin/env node
// TEMPLATE: GenbaHubスクショ撮影スクリプト 雛形
// 来歴: laporta-beads-4wos3 (GenbaHub: スクショ検収の自動ゲート) / worker(opus) / 2026-07-19
//
// 使い方: このファイルをコピーして tasks/<票ID>-shots.mjs 等にリネームし、
// 下のTODO箇所を埋める。captureScreenshot() は対象data-testidの可視化+非ローディングを
// waitForで保証してからスクショを撮る。生の page.screenshot() を直接呼ぶスクリプトは
// scripts/screenshot-gate.ts でNG(検収NG)判定される。
//
// 撮影対象の画面には data-testid を振っておくこと。ローディング中は
// data-testid="loading" な要素を出す(この規約が無い画面は loadingTestId で個別指定)。
//
// 検収ゲート実行:
//   node --experimental-strip-types scripts/screenshot-gate.ts tasks/<このファイル>.mjs

import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const OUT_DIR = path.join(process.cwd(), "tasks", "TODO-shots"); // TODO: 出力先ディレクトリ名
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.argv[2] || "http://localhost:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}/#/TODO-route`, { waitUntil: "networkidle" }); // TODO: 対象ルート
  await captureScreenshot(page, path.join(OUT_DIR, "TODO-name.png"), {
    testId: "TODO-target-data-testid", // TODO: 画面本体が可視になるdata-testid
    fullPage: true,
  });
  console.log("✓ TODO-name.png");

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
