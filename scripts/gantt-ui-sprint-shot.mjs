/**
 * gantt-ui-sprint-20260808: ガント画面のbefore/afterスクショ撮影。
 * e2e/gantt-compass-clone-verify.test.ts と同じシードデータで3画面幅を撮る。
 * 使い方: node scripts/gantt-ui-sprint-shot.mjs <label>   (label = before | after)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "before";
const outDir = "/Users/koki/laporta-strategy/gantt-ui-sprint-20260808";
fs.mkdirSync(outDir, { recursive: true });

const projectId = "55555555-5555-4555-8555-555555555555";
const project = {
  id: projectId,
  name: "銀座中央通り オフィス改装",
  description: "COMPASS UI verification",
  status: "active",
  mode: "normal",
  startDate: "2026-07-27",
  endDate: "2026-08-31",
  includeWeekends: false,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
};
const contractors = ["高橋内装", "中村電設", "佐藤建具"].map((name, index) => ({
  id: `cc55555${index}-5555-4555-8555-55555555555${index}`,
  name,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
}));
const tasks = [
  ["現地調査", "done", "2026-07-27", "2026-07-29", 100, "仮設工事", 0],
  ["デザイン最終確認", "done", "2026-07-30", "2026-08-02", 100, "仮設工事", 0],
  ["照明設計", "in_progress", "2026-08-03", "2026-08-07", 75, "電気工事", 1],
  ["電気配線工事", "in_progress", "2026-07-31", "2026-08-03", 50, "電気工事", 1],
  ["内装仕上げ工事", "in_progress", "2026-08-05", "2026-08-14", 20, "壁・天井仕上げ", 0],
  ["商品陳列・引渡し", "todo", "2026-08-12", "2026-08-18", 0, "検査", 2],
];
const seededTasks = tasks.map(([name, status, startDate, dueDate, progress, majorCategory, contractorIndex], index) => ({
  id: `aa55555${index}-5555-4555-8555-55555555555${index}`,
  projectId,
  name,
  description: "",
  status,
  startDate,
  dueDate,
  progress,
  dependencies: [],
  contractorId: contractors[contractorIndex].id,
  majorCategory,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
}));
const seed = {
  "genbahub:projects": [project],
  "genbahub:tasks": seededTasks,
  "genbahub:contractors": contractors,
  "genbahub:last-project-id": projectId,
};

const widths = [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
];

const browser = await chromium.launch();
try {
  for (const [name, width, height] of widths) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-08-05T09:00:00+09:00"));
    await page.addInitScript((data) => {
      window.__E2E_BYPASS_AUTH__ = true;
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      }
    }, seed);
    await page.goto("http://localhost:5173/#/gantt");
    await page.waitForSelector('[data-tour="gantt-chart"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `${label}-${name}-${width}x${height}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`saved: ${file}`);
    await context.close();
  }
} finally {
  await browser.close();
}
