#!/usr/bin/env node
// pe4m1 スクショ撮影: 工程ビュー切替 (今日/一覧/ガント/カード)
// 来歴: laporta-beads-pe4m1 (GenbaHub: 工程関連ルートと名称を統合) / worker(opus) / 2026-07-20
// 検収ゲート: node --experimental-strip-types scripts/screenshot-gate.ts tasks/pe4m1-shots.mjs
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const OUT_DIR = path.join(process.cwd(), "tasks", "pe4m1-after");
fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = process.argv[2] || "http://localhost:5173/#";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__E2E_BYPASS_AUTH__ = true; });
  const page = await ctx.newPage();

  // /app に入るとサンプル案件がseedされ /gantt/:id へ自動遷移する
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 25000 });
  await captureScreenshot(page, path.join(OUT_DIR, "view-gantt.png"), {
    testId: "project-view-switch",
    fullPage: false,
  });
  console.log("✓ view-gantt.png");

  // 一覧ビュー
  await page.getByRole("tab", { name: /一覧/ }).click();
  await captureScreenshot(page, path.join(OUT_DIR, "view-list.png"), {
    testId: "project-task-list",
    fullPage: false,
  });
  console.log("✓ view-list.png");

  // 今日ビュー
  await page.getByRole("tab", { name: /今日/ }).click();
  await captureScreenshot(page, path.join(OUT_DIR, "view-today.png"), {
    testId: "gantt-mobile-list",
    fullPage: false,
  });
  console.log("✓ view-today.png");

  // カードビュー（/cards へ遷移。switcherがカード活性で表示される）
  await page.getByRole("tab", { name: /カード/ }).click();
  await page.waitForFunction(() => window.location.hash.startsWith("#/cards/"), { timeout: 10000 });
  await captureScreenshot(page, path.join(OUT_DIR, "view-cards.png"), {
    testId: "card-board-page",
    fullPage: false,
  });
  console.log("✓ view-cards.png");

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
