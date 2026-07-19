#!/usr/bin/env node
// p94s2 スクショ撮影: 請求書OCR→請求書ハブ 単一フロー統合
// 来歴: laporta-beads-p94s2 (GenbaHub: 請求書OCRと管理を単一フローへ統合) / worker(opus) / 2026-07-20
// 検収ゲート: node --experimental-strip-types scripts/screenshot-gate.ts tasks/p94s2-shots.mjs
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const OUT_DIR = path.join(process.cwd(), "tasks", "p94s2-after");
fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = process.argv[2] || "http://localhost:5173/#";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  await ctx.addInitScript(() => { window.__E2E_BYPASS_AUTH__ = true; });
  const page = await ctx.newPage();

  // 案件をseed（/app でサンプル案件が作られる）→ 請求書ハブへ
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle", timeout: 20000 });
  await captureScreenshot(page, path.join(OUT_DIR, "hub-empty.png"), {
    testId: "invoice-management-page",
    fullPage: true,
  });
  console.log("✓ hub-empty.png (受領/確認待ち/支払予定/支払済み パイプライン)");

  // 手入力で1件登録 → 確認待ちレコードとして合流
  await page.getByRole("button", { name: "請求書を登録" }).first().click(); // ヘッダーのトグル
  const formCard = page.locator("div.rounded-xl", { has: page.getByRole("heading", { name: "請求書を登録" }) });
  await formCard.getByPlaceholder("田中工務店").fill("鈴木塗装");
  await formCard.getByPlaceholder("100000").fill("180000");
  await formCard.locator('input[type="date"]').first().fill("2026-07-20");
  await formCard.getByRole("button", { name: "請求書を登録" }).click(); // フォーム内の送信
  await page.waitForTimeout(800);
  await captureScreenshot(page, path.join(OUT_DIR, "hub-with-record.png"), {
    testId: "invoice-management-page",
    fullPage: true,
  });
  console.log("✓ hub-with-record.png (確認待ちに合流)");

  // OCRページ（OCR結果も同じ確認待ちレコードへ登録される）
  await page.goto(`${BASE}/invoice`, { waitUntil: "networkidle", timeout: 20000 });
  await captureScreenshot(page, path.join(OUT_DIR, "ocr-page.png"), {
    testId: "invoice-ocr-page",
    fullPage: true,
  });
  console.log("✓ ocr-page.png");

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
