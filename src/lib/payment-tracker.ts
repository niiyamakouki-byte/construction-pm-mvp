/**
 * Payment tracking — record, schedule, and report payments per project.
 */

export type Payment = {
  id: string;
  projectId: string;
  amount: number;
  vendor: string;
  date: string;
  status: "pending" | "paid" | "overdue";
  description?: string;
};

export type PaymentScheduleEntry = {
  payment: Payment;
  dueDate: string;
};

// In-memory store
const payments: Map<string, Payment[]> = new Map();
let nextId = 1;

export function recordPayment(
  projectId: string,
  amount: number,
  vendor: string,
  date: string,
  status: Payment["status"] = "paid",
  description?: string,
): Payment {
  const payment: Payment = {
    id: `pay-${nextId++}`,
    projectId,
    amount,
    vendor,
    date,
    status,
    description,
  };
  const list = payments.get(projectId) ?? [];
  list.push(payment);
  payments.set(projectId, list);
  return payment;
}

export function getPaymentSchedule(projectId: string): PaymentScheduleEntry[] {
  const list = payments.get(projectId) ?? [];
  return list.map((p) => ({ payment: p, dueDate: p.date }));
}

export function calculateOutstanding(projectId: string): number {
  const list = payments.get(projectId) ?? [];
  return list
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((sum, p) => sum + p.amount, 0);
}

export function generatePaymentReport(projectId: string): string {
  const list = payments.get(projectId) ?? [];
  const total = list.reduce((s, p) => s + p.amount, 0);
  const paid = list
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = calculateOutstanding(projectId);

  const rows = list
    .map(
      (p) =>
        `<tr><td>${p.date}</td><td>${p.vendor}</td><td>¥${p.amount.toLocaleString("ja-JP")}</td><td>${p.status}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8" /><title>支払レポート - ${projectId}</title></head>
<body>
<h1>支払レポート: ${projectId}</h1>
<p>合計: ¥${total.toLocaleString("ja-JP")} | 支払済: ¥${paid.toLocaleString("ja-JP")} | 未払: ¥${outstanding.toLocaleString("ja-JP")}</p>
<table><thead><tr><th>日付</th><th>業者</th><th>金額</th><th>ステータス</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

export function clearPayments(): void {
  payments.clear();
  nextId = 1;
}
