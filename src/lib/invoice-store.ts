/**
 * Invoice store — manage invoices linked to projects, with status tracking and monthly summaries.
 */

export type InvoiceStatus = "未確認" | "確認済" | "振込予定" | "振込済" | "保留";

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type Invoice = {
  id: string;
  projectId: string;
  vendorName: string;
  vendorContact?: string;
  amount: number;
  tax: number;
  total: number;
  items: InvoiceItem[];
  bankInfo?: string;
  registrationNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  paidDate?: string;
  pdfPath?: string;
};

export type PaymentTerm = "月末締め翌月払い" | "月末締め翌々月払い" | "即時払い" | "都度払い";

export type PaymentScheduleEntry = {
  invoice: Invoice;
  scheduledDate: string;
  term: PaymentTerm;
};

export type MonthlyInvoiceSummary = {
  unpaidTotal: number;
  thisMonthDueTotal: number;
  paidTotal: number;
};

// In-memory store
const invoices: Map<string, Invoice> = new Map();
let nextId = 1;

export function addInvoice(data: Omit<Invoice, "id">): Invoice {
  const invoice: Invoice = { ...data, id: `inv-${nextId++}` };
  invoices.set(invoice.id, invoice);
  return invoice;
}

export function getInvoice(id: string): Invoice | undefined {
  return invoices.get(id);
}

export function getAllInvoices(): Invoice[] {
  return Array.from(invoices.values());
}

export function getInvoicesByProject(projectId: string): Invoice[] {
  return Array.from(invoices.values()).filter((inv) => inv.projectId === projectId);
}

export function getInvoicesByStatus(status: InvoiceStatus): Invoice[] {
  return Array.from(invoices.values()).filter((inv) => inv.status === status);
}

export function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  paidDate?: string,
): Invoice | undefined {
  const invoice = invoices.get(id);
  if (!invoice) return undefined;
  const updated: Invoice = {
    ...invoice,
    status,
    paidDate: status === "振込済" ? (paidDate ?? new Date().toISOString().slice(0, 10)) : invoice.paidDate,
  };
  invoices.set(id, updated);
  return updated;
}

export function updateInvoice(id: string, data: Partial<Omit<Invoice, "id">>): Invoice | undefined {
  const invoice = invoices.get(id);
  if (!invoice) return undefined;
  const updated: Invoice = { ...invoice, ...data };
  invoices.set(id, updated);
  return updated;
}

export function deleteInvoice(id: string): boolean {
  return invoices.delete(id);
}

export function clearInvoices(): void {
  invoices.clear();
  nextId = 1;
}

/**
 * Monthly summary for a given YYYY-MM string.
 */
export function getMonthlyInvoiceSummary(yearMonth: string): MonthlyInvoiceSummary {
  const all = Array.from(invoices.values());
  const unpaidTotal = all
    .filter((inv) => inv.status === "未確認" || inv.status === "確認済" || inv.status === "振込予定")
    .reduce((sum, inv) => sum + inv.total, 0);

  const thisMonthDueTotal = all
    .filter(
      (inv) =>
        inv.dueDate?.startsWith(yearMonth) &&
        (inv.status === "振込予定" || inv.status === "確認済" || inv.status === "未確認"),
    )
    .reduce((sum, inv) => sum + inv.total, 0);

  const paidTotal = all
    .filter((inv) => inv.status === "振込済" && inv.paidDate?.startsWith(yearMonth))
    .reduce((sum, inv) => sum + inv.total, 0);

  return { unpaidTotal, thisMonthDueTotal, paidTotal };
}

/**
 * Compute scheduled payment date based on invoice date and payment term.
 */
export function computeScheduledDate(invoiceDate: string, term: PaymentTerm): string {
  // Parse as UTC to avoid timezone drift
  const [year, month] = invoiceDate.split("-").map(Number) as [number, number];
  // month is 1-based; last day of target month using UTC
  function lastDayOfMonth(y: number, m: number): string {
    // Day 0 of month (m+1) = last day of month m (1-based)
    const d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
  }
  switch (term) {
    case "月末締め翌月払い":
      return lastDayOfMonth(year, month + 1);
    case "月末締め翌々月払い":
      return lastDayOfMonth(year, month + 2);
    case "即時払い":
      return invoiceDate;
    case "都度払い":
      return invoiceDate;
    default:
      return invoiceDate;
  }
}

/**
 * Build payment schedule for all pending invoices.
 */
export function buildPaymentSchedule(term: PaymentTerm = "月末締め翌月払い"): PaymentScheduleEntry[] {
  return Array.from(invoices.values())
    .filter(
      (inv) => inv.status === "振込予定" || inv.status === "確認済" || inv.status === "未確認",
    )
    .map((inv) => ({
      invoice: inv,
      scheduledDate: inv.dueDate ?? computeScheduledDate(inv.invoiceDate, term),
      term,
    }))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

/**
 * Register an invoice as a cost item (returns cost-item-compatible data).
 */
export type InvoiceCostEntry = {
  projectId: string;
  description: string;
  amount: number;
  date: string;
  vendor: string;
};

export function invoiceToCostEntry(invoice: Invoice): InvoiceCostEntry {
  return {
    projectId: invoice.projectId,
    description: `請求書: ${invoice.vendorName}`,
    amount: invoice.total,
    date: invoice.invoiceDate,
    vendor: invoice.vendorName,
  };
}
