/**
 * Document templates — invoice, progress report, change order, daily log.
 */

export type Template = {
  id: string;
  name: string;
  type: "invoice" | "progress_report" | "change_order" | "daily_log";
  createdAt: string;
};

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function createInvoiceTemplate(
  project: string,
  vendor: string,
  items: InvoiceItem[],
): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.description}</td><td>${i.quantity}</td><td>¥${i.unitPrice.toLocaleString()}</td><td>¥${(i.quantity * i.unitPrice).toLocaleString()}</td></tr>`,
    )
    .join("\n");
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return `<!DOCTYPE html>
<html><head><title>Invoice - ${project}</title></head>
<body>
<h1>請求書</h1>
<p>Project: ${project} | Vendor: ${vendor}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<p><strong>Total: ¥${total.toLocaleString()}</strong></p>
</body></html>`;
}

export type Milestone = {
  name: string;
  completed: boolean;
  date?: string;
};

export function createProgressReport(
  project: string,
  milestones: Milestone[],
): string {
  const completed = milestones.filter((m) => m.completed).length;
  const pct = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;
  const rows = milestones
    .map(
      (m) =>
        `<tr><td>${m.name}</td><td>${m.completed ? "✓" : "—"}</td><td>${m.date ?? ""}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html><head><title>Progress Report - ${project}</title></head>
<body>
<h1>Progress Report: ${project}</h1>
<p>Completion: ${pct}% (${completed}/${milestones.length})</p>
<table><thead><tr><th>Milestone</th><th>Status</th><th>Date</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

export type ChangeItem = {
  description: string;
  cost: number;
};

export function createChangeOrder(
  project: string,
  changes: ChangeItem[],
  totalCost: number,
): string {
  const rows = changes
    .map((c) => `<tr><td>${c.description}</td><td>¥${c.cost.toLocaleString()}</td></tr>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><title>Change Order - ${project}</title></head>
<body>
<h1>変更指示書: ${project}</h1>
<table><thead><tr><th>Change</th><th>Cost</th></tr></thead>
<tbody>${rows}</tbody></table>
<p><strong>Total Additional Cost: ¥${totalCost.toLocaleString()}</strong></p>
</body></html>`;
}

export type Activity = {
  time: string;
  description: string;
  worker?: string;
};

export function createDailyLog(
  project: string,
  date: string,
  activities: Activity[],
): string {
  const rows = activities
    .map(
      (a) =>
        `<tr><td>${a.time}</td><td>${a.description}</td><td>${a.worker ?? ""}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html><head><title>Daily Log - ${project} - ${date}</title></head>
<body>
<h1>日報: ${project}</h1>
<p>Date: ${date}</p>
<table><thead><tr><th>Time</th><th>Activity</th><th>Worker</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}
