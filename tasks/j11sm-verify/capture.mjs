// Ticket: laporta-beads-j11sm | Author: Codex | 2026-08-06
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectId = "33333333-3333-3333-3333-333333333333";
const root = path.dirname(fileURLToPath(import.meta.url));
const stage = process.env.SCREENSHOT_STAGE ?? "after";
const baseUrl = process.env.GENBAHUB_URL ?? "http://127.0.0.1:5173";
const outDir = path.join(root, stage);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(({ projectId }) => {
  window.__E2E_BYPASS_AUTH__ = true;
  localStorage.setItem("genbahub_onboarding_done", "1");
  localStorage.setItem("genbahub_tour_done", "1");
  localStorage.setItem("genbahub:last-project-id", projectId);
  localStorage.setItem("genbahub:projects", JSON.stringify([{
    id: projectId,
    name: "渋谷オフィスビル内装工事",
    description: "390px検証用",
    status: "active",
    mode: "normal",
    startDate: "2026-08-01",
    includeWeekends: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  }]));
  localStorage.setItem("genbahub:tasks", JSON.stringify([{
    id: "dd000001-0000-0000-0000-000000000001",
    projectId,
    name: "解体・撤去工事",
    status: "done",
    startDate: "2026-08-01",
    dueDate: "2026-08-12",
    progress: 100,
    dependencies: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  }]));
}, { projectId });
const page = await context.newPage();

await page.goto(`${baseUrl}/#/landing`, { waitUntil: "domcontentloaded" });
const comparison = page.locator("#comparison");
await comparison.waitFor();
await comparison.scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(outDir, "01-landing-comparison-390.png"), animations: "disabled" });
const landingWidth = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  document: document.documentElement.scrollWidth,
}));
console.log(`landing width: ${landingWidth.document}/${landingWidth.viewport}`);

await page.goto(`${baseUrl}/#/gantt`, { waitUntil: "domcontentloaded" });
const editSummary = page.locator("details").filter({ has: page.getByText("編集", { exact: true }) }).locator("summary");
await editSummary.waitFor();
await editSummary.click();
const editMenu = editSummary.locator("xpath=following-sibling::div[1]");
const menuBox = await editMenu.boundingBox();
if (!menuBox) throw new Error("gantt edit menu did not open");
await page.screenshot({ path: path.join(outDir, "02-gantt-edit-menu-390.png"), animations: "disabled" });
console.log(`gantt edit menu: left=${Math.round(menuBox.x)}, right=${Math.round(menuBox.x + menuBox.width)}`);

const menuBoxes = [menuBox];
await editSummary.click();
for (const label of ["出力", "分析"]) {
  const summary = page.locator("details").filter({ has: page.getByText(label, { exact: true }) }).locator("summary");
  await summary.click();
  const box = await summary.locator("xpath=following-sibling::div[1]").boundingBox();
  if (!box) throw new Error(`gantt ${label} menu did not open`);
  menuBoxes.push(box);
  console.log(`gantt ${label} menu: left=${Math.round(box.x)}, right=${Math.round(box.x + box.width)}`);
  await summary.click();
}

if (stage === "after") {
  if (landingWidth.document > landingWidth.viewport) throw new Error("landing still overflows horizontally");
  if (menuBoxes.some((box) => box.x < 0 || box.x + box.width > 390)) throw new Error("gantt menu still leaves viewport");
}

await browser.close();
console.log(`${stage}: 2 mobile screenshots captured`);
