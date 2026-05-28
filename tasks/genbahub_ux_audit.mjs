/* global process, document, location, window, localStorage, console */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.GENBAHUB_AUDIT_BASE_URL || "http://127.0.0.1:5173";
const outDir = path.resolve("tasks/genbahub_ux_audit_full_2026-05-27");

const routes = [
  ["/", "Landing"],
  ["/login", "Login"],
  ["/signup", "Signup"],
  ["/pricing", "Pricing"],
  ["/today", "TodayDashboard"],
  ["/app", "Project list"],
  ["/gantt", "Gantt"],
  ["/tasks", "Tasks"],
  ["/cross-project-gantt", "Cross Project Gantt"],
  ["/crm", "CRM"],
  ["/project/demo-project", "ProjectDetail"],
  ["/contractors", "Contractors"],
  ["/notifications", "Notifications"],
  ["/photos", "Photo"],
  ["/mood-board/demo-project", "MoodBoard"],
  ["/selection/demo-project", "SelectionBoard"],
  ["/finishing", "Finishing Schedule"],
  ["/node-schedule", "NodeSchedule"],
  ["/safety", "SafetyInspection"],
  ["/schedule", "ScheduleFromEstimate"],
  ["/phase-templates", "PhaseTemplateLibrary"],
  ["/entry/demo-project", "SiteEntry"],
  ["/progress-review", "ProgressReview"],
  ["/estimate", "Estimate"],
  ["/cost-management", "CostManagement"],
  ["/procurement", "Procurement"],
  ["/orders", "OrderManagement"],
  ["/invoice", "Invoice"],
  ["/invoices", "InvoiceManagement"],
  ["/invoices/reconcile", "InvoiceReconcile"],
  ["/freee", "Freee"],
  ["/reports", "Reports"],
  ["/client/demo-project", "ClientViewer"],
  ["/owner-app/demo-project?token=demo", "OwnerApp"],
  ["/portal/share/demo-token", "SharePortal"],
  ["/portal/demo-project/demo-company", "ContractorPortal"],
  ["/help", "Help"],
  ["/account", "AccountSettings"],
  ["/legal/privacy", "LegalPages"],
  ["/attendance-history/demo-project", "AttendanceHistory"],
  ["/insurance-assessment", "InsuranceAssessment"],
];

const viewports = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844, isMobile: true }],
];

function slug(route) {
  return route.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "root";
}

async function capture(page, route, name, viewportName) {
  await page.setViewportSize(viewports.find(([label]) => label === viewportName)[1]);
  await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(700);
  const file = `${viewportName}-${slug(route)}.png`;
  const shotPath = path.join(outDir, file);
  await page.screenshot({ path: shotPath, fullPage: true });
  const data = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    const headings = Array.from(document.querySelectorAll("h1,h2,h3")).slice(0, 12).map((el) => el.textContent?.trim()).filter(Boolean);
    const buttons = Array.from(document.querySelectorAll("button,a,input,select,textarea")).slice(0, 60).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("value") || "").trim(),
      disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
    }));
    const rects = Array.from(document.querySelectorAll("main, h1, h2, button, a, input, select, textarea, [role='dialog']")).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 80),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }).filter((r) => r.w > 0 && r.h > 0);
    const narrowText = rects.filter((r) => r.w > 0 && r.w < 44 && /[ぁ-んァ-ヶ一-龠A-Za-z]{2,}/.test(r.text)).slice(0, 10);
    return {
      title: document.title,
      url: location.href,
      text: text.slice(0, 2500),
      headings,
      buttons,
      dialog: Boolean(document.querySelector("[role='dialog']")),
      narrowText,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    };
  });
  return { route, name, viewport: viewportName, screenshot: shotPath, ...data };
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  window.__E2E_BYPASS_AUTH__ = true;
  localStorage.setItem("genbahub_onboarding_done", "1");
  localStorage.setItem("genbahub_tour_done", "1");
});
const page = await context.newPage();
const results = [];
for (const [route, name] of routes) {
  for (const [viewportName] of viewports) {
    try {
      results.push(await capture(page, route, name, viewportName));
      console.log(`ok ${viewportName} ${route}`);
    } catch (error) {
      results.push({ route, name, viewport: viewportName, error: error instanceof Error ? error.message : String(error) });
      console.log(`error ${viewportName} ${route}`);
    }
  }
}
await browser.close();
await fs.writeFile(path.join(outDir, "audit-results.json"), JSON.stringify(results, null, 2));
console.log(path.join(outDir, "audit-results.json"));
