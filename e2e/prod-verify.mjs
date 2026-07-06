// Standalone prod verification: seeds auth-bypass + demo data, screenshots /today,
// re-measures WCAG contrast on the LIVE production build.
// Usage: node e2e/prod-verify.mjs <baseUrl>
import { chromium } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "screenshots", "today-contrast-verify");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const PID = "4b9e1234-5678-4abc-bdef-000000000001";
const CID = "aaaaaaaa-1111-4aaa-8aaa-000000000001";

const SEED_PROJECTS = [{
  id: PID, name: "GenbaHubデモ案件", description: "検証用", status: "active", mode: "normal",
  startDate: "2026-06-28", endDate: "2026-08-31", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
}];
const SEED_CONTRACTORS = [{ id: CID, name: "株式会社ラポルタ", trade: "内装", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z" }];
const mkTask = (n, status, prog) => ({
  id: `bbbbbbbb-2222-4bbb-8bbb-00000000000${n}`, projectId: PID, name: `作業${n}`, status,
  startDate: "2026-07-01", dueDate: "2026-07-20", progress: prog, dependencies: [], contractorId: CID,
  majorCategory: "施工", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
});
const SEED_TASKS = [mkTask(1, "done", 100), mkTask(2, "in_progress", 40), mkTask(3, "todo", 0)];

const AUDIT_FN = fs.readFileSync(path.join(__dirname, "today-contrast-verify.test.ts"), "utf8")
  .match(/const AUDIT_FN = `([\s\S]*?)`;/)[1];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
const page = await ctx.newPage();
await page.addInitScript(({ projects, tasks, contractors, pid }) => {
  window.__E2E_BYPASS_AUTH__ = true;
  localStorage.setItem("genbahub:projects", JSON.stringify(projects));
  localStorage.setItem("genbahub:tasks", JSON.stringify(tasks));
  localStorage.setItem("genbahub:contractors", JSON.stringify(contractors));
  localStorage.setItem("genbahub:last-project-id", pid);
}, { projects: SEED_PROJECTS, tasks: SEED_TASKS, contractors: SEED_CONTRACTORS, pid: PID });

await page.goto(`${BASE}/#/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "today-prod-after.png"), fullPage: true });

const results = await page.evaluate(AUDIT_FN);
const sage = results.filter(r => r.color === "rgb(52, 101, 56)");
const jido = results.find(r => (r.text || "").includes("自動"));
const legacyGreen = results.filter(r => r.color === "rgb(76, 175, 80)" || r.color === "rgb(5, 150, 105)");

console.log("PROD:", BASE);
console.log("total text nodes:", results.length);
console.log("sage-green KPI nodes:", sage.length, "| all pass:", sage.every(r => r.pass));
sage.slice(0, 12).forEach(r => console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.ratio}:1 ${JSON.stringify(r.text)} bg=${r.bg}`));
console.log("自動 header label:", jido ? `${jido.pass ? "PASS" : "FAIL"} ${jido.ratio}:1` : "NOT FOUND");
console.log("legacy failing greens remaining:", legacyGreen.length);
fs.writeFileSync(path.join(outDir, "contrast-results-prod.json"), JSON.stringify({ base: BASE, total: results.length, sage, jido, legacyGreen }, null, 2));

await browser.close();
const ok = sage.length > 0 && sage.every(r => r.pass) && jido && jido.pass && legacyGreen.length === 0;
console.log(ok ? "\nRESULT: PASS — fix is live in production" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
