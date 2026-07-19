#!/usr/bin/env node
// ftaqp スクショ撮影: モバイル工程表 7日縦リスト + 全画面ガント
// 来歴: laporta-beads-ftaqp (GenbaHub: モバイル工程表を7日縦リスト化) / worker(opus) / 2026-07-20
// 検収ゲート: node --experimental-strip-types scripts/screenshot-gate.ts tasks/ftaqp-shots.mjs
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const OUT_DIR = path.join(process.cwd(), "tasks", "ftaqp-after");
fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = process.argv[2] || "http://localhost:5173/#";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__E2E_BYPASS_AUTH__ = true; });
  const page = await ctx.newPage();

  // /app に入るとサンプル案件がseedされ /gantt/:id へ自動遷移する
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 25000 });
  await captureScreenshot(page, path.join(OUT_DIR, "mobile-list.png"), {
    testId: "gantt-mobile-list",
    fullPage: true,
  });
  console.log("✓ mobile-list.png");

  // 「ガントを見る」→ 全画面ガント
  await page.getByTestId("gantt-show-timeline").click();
  await captureScreenshot(page, path.join(OUT_DIR, "timeline-fullscreen.png"), {
    testId: "gantt-timeline-fullscreen",
    fullPage: false,
  });
  console.log("✓ timeline-fullscreen.png");

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
