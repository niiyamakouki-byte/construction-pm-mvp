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
        `<tr><td>${i.description}</td><td>${i.quantity}</td><td>¥${i.unitPrice.toLocaleString("ja-JP")}</td><td>¥${(i.quantity * i.unitPrice).toLocaleString("ja-JP")}</td></tr>`,
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
<p><strong>Total: ¥${total.toLocaleString("ja-JP")}</strong></p>
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
<html lang="ja"><head><meta charset="UTF-8" /><title>進捗レポート - ${project}</title></head>
<body>
<h1>進捗レポート: ${project}</h1>
<p>完了率: ${pct}% (${completed}/${milestones.length})</p>
<table><thead><tr><th>マイルストーン</th><th>ステータス</th><th>日付</th></tr></thead>
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
    .map((c) => `<tr><td>${c.description}</td><td>¥${c.cost.toLocaleString("ja-JP")}</td></tr>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8" /><title>変更指示書 - ${project}</title></head>
<body>
<h1>変更指示書: ${project}</h1>
<table><thead><tr><th>変更内容</th><th>金額</th></tr></thead>
<tbody>${rows}</tbody></table>
<p><strong>追加費用合計: ¥${totalCost.toLocaleString("ja-JP")}</strong></p>
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
