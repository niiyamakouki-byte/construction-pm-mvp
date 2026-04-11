/**
 * Safety Inspection module for GenbaHub.
 * Provides checklist creation, evaluation, and HTML report generation
 * for construction site safety inspections.
 */
import { escapeHtml } from "./utils/escape-html";

export type ChecklistItemStatus = "pass" | "fail" | "na";

export type ChecklistItem = {
  category: string;
  description: string;
  status: ChecklistItemStatus;
  notes: string;
};

export type InspectionResult = "pass" | "fail" | "pending";

export type InspectionChecklist = {
  id: string;
  projectId: string;
  items: ChecklistItem[];
  inspectedBy: string;
  date: string;
  result: InspectionResult;
};

export type EvaluationResult = {
  totalItems: number;
  passCount: number;
  failCount: number;
  naCount: number;
  passRate: number;
  criticalFailures: ChecklistItem[];
};

const CRITICAL_CATEGORIES = [
  "fall-protection",
  "electrical",
  "excavation",
  "scaffolding",
  "crane-operations",
];

type ProjectType = "general" | "renovation" | "demolition" | "high-rise";

const DEFAULT_ITEMS: Record<ProjectType, ChecklistItem[]> = {
  general: [
    { category: "ppe", description: "All workers wearing hard hats", status: "pass", notes: "" },
    { category: "ppe", description: "Safety vests visible on all personnel", status: "pass", notes: "" },
    { category: "ppe", description: "Steel-toe boots worn by all workers", status: "pass", notes: "" },
    { category: "fall-protection", description: "Guardrails installed at open edges", status: "pass", notes: "" },
    { category: "fall-protection", description: "Safety nets in place where required", status: "pass", notes: "" },
    { category: "electrical", description: "GFCI protection on all temporary power", status: "pass", notes: "" },
    { category: "electrical", description: "Extension cords in good condition", status: "pass", notes: "" },
    { category: "housekeeping", description: "Work area free of debris and tripping hazards", status: "pass", notes: "" },
    { category: "housekeeping", description: "Material storage areas organized", status: "pass", notes: "" },
    { category: "fire-safety", description: "Fire extinguishers accessible and inspected", status: "pass", notes: "" },
    { category: "fire-safety", description: "Hot work permits posted where applicable", status: "pass", notes: "" },
    { category: "signage", description: "Safety signs posted at site entrance", status: "pass", notes: "" },
  ],
  renovation: [
    { category: "ppe", description: "All workers wearing hard hats", status: "pass", notes: "" },
    { category: "ppe", description: "Respiratory protection available for dust work", status: "pass", notes: "" },
    { category: "ppe", description: "Safety vests visible on all personnel", status: "pass", notes: "" },
    { category: "hazmat", description: "Asbestos survey completed before work", status: "pass", notes: "" },
    { category: "hazmat", description: "Lead paint assessment done", status: "pass", notes: "" },
    { category: "electrical", description: "Existing circuits de-energized and locked out", status: "pass", notes: "" },
    { category: "electrical", description: "GFCI protection on temporary power", status: "pass", notes: "" },
    { category: "structural", description: "Load-bearing walls identified and protected", status: "pass", notes: "" },
    { category: "structural", description: "Temporary shoring in place where needed", status: "pass", notes: "" },
    { category: "housekeeping", description: "Debris removal on schedule", status: "pass", notes: "" },
    { category: "fire-safety", description: "Fire extinguishers accessible and inspected", status: "pass", notes: "" },
    { category: "signage", description: "Safety signs posted at site entrance", status: "pass", notes: "" },
  ],
  demolition: [
    { category: "ppe", description: "All workers wearing hard hats", status: "pass", notes: "" },
    { category: "ppe", description: "Respiratory protection for all demolition workers", status: "pass", notes: "" },
    { category: "ppe", description: "Hearing protection available", status: "pass", notes: "" },
    { category: "hazmat", description: "Asbestos abatement completed", status: "pass", notes: "" },
    { category: "hazmat", description: "Lead paint safely removed or encapsulated", status: "pass", notes: "" },
    { category: "excavation", description: "Underground utilities located and marked", status: "pass", notes: "" },
    { category: "excavation", description: "Exclusion zones established", status: "pass", notes: "" },
    { category: "structural", description: "Engineering survey completed", status: "pass", notes: "" },
    { category: "structural", description: "Demolition sequence plan posted", status: "pass", notes: "" },
    { category: "housekeeping", description: "Debris chutes or containers in place", status: "pass", notes: "" },
    { category: "fire-safety", description: "Fire watch during hot work", status: "pass", notes: "" },
    { category: "signage", description: "Demolition warning signs posted", status: "pass", notes: "" },
  ],
  "high-rise": [
    { category: "ppe", description: "All workers wearing hard hats", status: "pass", notes: "" },
    { category: "ppe", description: "Safety harnesses inspected and worn above 2m", status: "pass", notes: "" },
    { category: "ppe", description: "Safety vests visible on all personnel", status: "pass", notes: "" },
    { category: "fall-protection", description: "Perimeter guardrails on all open floors", status: "pass", notes: "" },
    { category: "fall-protection", description: "Floor openings covered or guarded", status: "pass", notes: "" },
    { category: "fall-protection", description: "Safety nets installed below work areas", status: "pass", notes: "" },
    { category: "scaffolding", description: "Scaffolding inspected by competent person", status: "pass", notes: "" },
    { category: "scaffolding", description: "Scaffold planking secure and complete", status: "pass", notes: "" },
    { category: "crane-operations", description: "Crane daily inspection completed", status: "pass", notes: "" },
    { category: "crane-operations", description: "Rigging inspected before each lift", status: "pass", notes: "" },
    { category: "electrical", description: "GFCI protection on all temporary power", status: "pass", notes: "" },
    { category: "fire-safety", description: "Fire extinguishers on every active floor", status: "pass", notes: "" },
    { category: "signage", description: "Safety signs posted at site entrance and elevators", status: "pass", notes: "" },
  ],
};

/**
 * Create a default safety checklist pre-populated with items
 * appropriate for the given project type.
 */
export function createDefaultChecklist(
  projectType: ProjectType = "general",
): Omit<InspectionChecklist, "id" | "projectId" | "inspectedBy" | "date"> {
  const items = (DEFAULT_ITEMS[projectType] ?? DEFAULT_ITEMS.general).map((item) => ({
    ...item,
  }));
  return {
    items,
    result: "pending",
  };
}

/**
 * Evaluate a completed checklist: compute pass rate and identify critical failures.
 */
export function evaluateChecklist(checklist: InspectionChecklist): EvaluationResult {
  const { items } = checklist;
  const totalItems = items.length;
  const passCount = items.filter((i) => i.status === "pass").length;
  const failCount = items.filter((i) => i.status === "fail").length;
  const naCount = items.filter((i) => i.status === "na").length;

  const gradedItems = totalItems - naCount;
  const passRate = gradedItems > 0 ? passCount / gradedItems : 1;

  const criticalFailures = items.filter(
    (i) => i.status === "fail" && CRITICAL_CATEGORIES.includes(i.category),
  );

  return {
    totalItems,
    passCount,
    failCount,
    naCount,
    passRate,
    criticalFailures,
  };
}

/**
 * Generate a printable HTML inspection report.
 */
export function generateInspectionReport(checklist: InspectionChecklist): string {
  const evaluation = evaluateChecklist(checklist);
  const passPercent = (evaluation.passRate * 100).toFixed(1);
  const overallResult = evaluation.criticalFailures.length > 0 || evaluation.failCount > 0 ? "FAIL" : "PASS";
  const resultColor = overallResult === "PASS" ? "#22c55e" : "#ef4444";

  const categorized = new Map<string, ChecklistItem[]>();
  for (const item of checklist.items) {
    const list = categorized.get(item.category) ?? [];
    list.push(item);
    categorized.set(item.category, list);
  }

  let categoryRows = "";
  for (const [category, items] of categorized.entries()) {
    categoryRows += `<tr><td colspan="3" style="background:#f3f4f6;font-weight:bold;padding:8px;">${escapeHtml(category.toUpperCase())}</td></tr>`;
    for (const item of items) {
      const statusIcon = item.status === "pass" ? "&#9989;" : item.status === "fail" ? "&#10060;" : "&#8212;";
      const rowBg = item.status === "fail" ? "background:#fef2f2;" : "";
      categoryRows += `<tr style="${rowBg}"><td style="padding:6px 8px;">${statusIcon}</td><td style="padding:6px 8px;">${escapeHtml(item.description)}</td><td style="padding:6px 8px;">${escapeHtml(item.notes)}</td></tr>`;
    }
  }

  let criticalSection = "";
  if (evaluation.criticalFailures.length > 0) {
    const critItems = evaluation.criticalFailures
      .map((f) => `<li>${escapeHtml(f.category)}: ${escapeHtml(f.description)}${f.notes ? " - " + escapeHtml(f.notes) : ""}</li>`)
      .join("");
    criticalSection = `<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:4px;padding:12px;margin:16px 0;"><h3 style="color:#ef4444;margin:0 0 8px;">Critical Failures</h3><ul>${critItems}</ul></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Safety Inspection Report</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1f2937;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th,td{border:1px solid #d1d5db;text-align:left;}
th{background:#1f2937;color:white;padding:8px;}
@media print{body{padding:0;}}
</style>
</head>
<body>
<h1>Safety Inspection Report</h1>
<table>
<tr><td><strong>Project ID</strong></td><td>${escapeHtml(checklist.projectId)}</td></tr>
<tr><td><strong>Inspector</strong></td><td>${escapeHtml(checklist.inspectedBy)}</td></tr>
<tr><td><strong>Date</strong></td><td>${escapeHtml(checklist.date)}</td></tr>
<tr><td><strong>Result</strong></td><td style="color:${resultColor};font-weight:bold;">${overallResult}</td></tr>
<tr><td><strong>Pass Rate</strong></td><td>${passPercent}%</td></tr>
</table>
${criticalSection}
<h2>Checklist Details</h2>
<table>
<thead><tr><th>Status</th><th>Description</th><th>Notes</th></tr></thead>
<tbody>${categoryRows}</tbody>
</table>
<footer style="margin-top:24px;font-size:12px;color:#6b7280;">Generated by GenbaHub Safety Inspection Module</footer>
</body>
</html>`;
}

