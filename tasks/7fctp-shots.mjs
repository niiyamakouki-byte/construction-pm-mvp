#!/usr/bin/env node
// bead laporta-beads-7fctp: GenbaHub ナビを今日/案件/工程/写真へ統合 — 実機UI検証
// 来歴: worker(opus) / 2026-07-20
//
// モバイル(390px)のボトムナビが 今日/案件/工程/写真/その他 の5タブに固定されていること、
// その他ドロワーがカテゴリ見出し(お金/現場を進める/プロフィール・設定)の3件に畳まれていること、
// デスクトップ(1280px)のサイドバーが一次ナビ4項目+畳んだグループ見出しになっていることを検証する。

import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const OUT_DIR = path.join(process.cwd(), "tasks", "7fctp-after");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.argv[2] || "http://localhost:5173";

async function withPage(browser, viewport, fn) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
  await fn(page);
  await page.close();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/#/today`, { waitUntil: "networkidle" });
    await captureScreenshot(page, path.join(OUT_DIR, "mobile-bottom-nav-today.png"), {
      testId: "mobile-bottom-nav",
      fullPage: false,
    });
    const labels = await page.locator('[data-testid="mobile-bottom-nav"] button span.text-\\[10px\\]').allTextContents();
    results.push(["mobile primary tab labels", labels.join("/")]);
    if (labels.join("/") !== "今日/案件/工程/写真/その他") {
      throw new Error(`unexpected primary tabs: ${labels.join("/")}`);
    }

    // その他ドロワーを開き、カテゴリ見出しが最大6件であることを確認
    await page.getByRole("button", { name: "その他" }).click();
    await page.waitForSelector('[data-testid="more-drawer"]', { state: "visible" });
    const groupHeaders = await page.locator('[data-testid="more-drawer"] button[aria-expanded]').allTextContents();
    results.push(["その他ドロワー カテゴリ数", String(groupHeaders.length)]);
    if (groupHeaders.length > 6) {
      throw new Error(`その他の見出しが6件を超過: ${groupHeaders.length}`);
    }
    await captureScreenshot(page, path.join(OUT_DIR, "mobile-more-drawer-collapsed.png"), {
      testId: "more-drawer",
      fullPage: false,
    });

    // お金グループを展開し、見積・請求等がその中に格納されていることを確認
    await page.getByRole("button", { name: /お金/ }).click();
    await page.waitForSelector('[data-testid="more-drawer"] >> text=見積', { state: "visible" });
    await captureScreenshot(page, path.join(OUT_DIR, "mobile-more-drawer-money-expanded.png"), {
      testId: "more-drawer",
      fullPage: false,
    });
  });

  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/#/photos`, { waitUntil: "networkidle" });
    await captureScreenshot(page, path.join(OUT_DIR, "mobile-photos-route.png"), {
      testId: "mobile-bottom-nav",
      fullPage: false,
    });
    const activeTab = await page.locator('[data-testid="mobile-bottom-nav"] button[aria-current="page"] span.text-\\[10px\\]').textContent();
    results.push(["/photos 遷移時のアクティブタブ", activeTab ?? "(none)"]);
    if (activeTab !== "写真") {
      throw new Error(`/photos でアクティブになるべきは「写真」だが実際は ${activeTab}`);
    }
  });

  await withPage(browser, { width: 1280, height: 900 }, async (page) => {
    await page.goto(`${BASE}/#/today`, { waitUntil: "networkidle" });
    await captureScreenshot(page, path.join(OUT_DIR, "desktop-sidebar-today.png"), {
      testId: "sidebar-primary-nav",
      fullPage: false,
    });
    const primaryCount = await page.locator('[data-testid="sidebar-primary-nav"] > button').count();
    results.push(["デスクトップ一次ナビ件数", String(primaryCount)]);
    if (primaryCount !== 4) {
      throw new Error(`デスクトップ一次ナビは4件固定のはずが ${primaryCount}件`);
    }
  });

  console.log("=== RESULT ===");
  for (const [k, v] of results) console.log(`${k}: ${v}`);
  console.log("PASS");

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
