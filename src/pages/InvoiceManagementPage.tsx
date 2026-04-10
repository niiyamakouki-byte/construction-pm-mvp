import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { createProjectRepository } from "../stores/project-store.js";
import {
  addInvoice,
  getAllInvoices,
  updateInvoiceStatus,
  deleteInvoice,
  getMonthlyInvoiceSummary,
  buildPaymentSchedule,
  invoiceToCostEntry,
  type Invoice,
  type InvoiceStatus,
  type PaymentTerm,
} from "../lib/invoice-store.js";

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const STATUS_OPTIONS: InvoiceStatus[] = ["未確認", "確認済", "振込予定", "振込済", "保留"];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  未確認: "bg-yellow-100 text-yellow-800",
  確認済: "bg-blue-100 text-blue-800",
  振込予定: "bg-orange-100 text-orange-800",
  振込済: "bg-green-100 text-green-800",
  保留: "bg-slate-100 text-slate-600",
};

type FilterStatus = "全部" | InvoiceStatus;

const EMPTY_FORM = {
  vendorName: "",
  vendorContact: "",
  amount: "",
  tax: "",
  invoiceDate: "",
  dueDate: "",
  bankInfo: "",
  registrationNumber: "",
  pdfPath: "",
};

export function InvoiceManagementPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formProjectId, setFormProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 7); // YYYY-MM

  const loadProjects = useCallback(async () => {
    try {
      const all = await projectRepository.findAll();
      setProjects(all.map((p) => ({ id: p.id, name: p.name })));
      if (all.length > 0 && !formProjectId) setFormProjectId(all[0].id);
    } catch {
      // non-critical
    }
  }, [projectRepository, formProjectId]);

  const [loaded, setLoaded] = useState(false);
  if (!loaded) {
    setLoaded(true);
    void loadProjects();
  }

  // Refresh invoice list from in-memory store
  const refreshInvoices = useCallback(() => {
    setInvoices([...getAllInvoices()]);
  }, []);

  useEffect(() => {
    refreshInvoices();
  }, [refreshInvoices]);

  const filteredInvoices = useMemo(() => {
    if (filterStatus === "全部") return invoices;
    return invoices.filter((inv) => inv.status === filterStatus);
  }, [invoices, filterStatus]);

  const summary = useMemo(() => getMonthlyInvoiceSummary(today), [invoices, today]);

  const paymentSchedule = useMemo(
    () => buildPaymentSchedule("月末締め翌月払い" as PaymentTerm),
    [invoices],
  );

  const thisMonthSchedule = useMemo(
    () => paymentSchedule.filter((e) => e.scheduledDate.startsWith(today)),
    [paymentSchedule, today],
  );

  const handleStatusChange = useCallback(
    (id: string, status: InvoiceStatus) => {
      updateInvoiceStatus(id, status);
      refreshInvoices();
    },
    [refreshInvoices],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!confirm("この請求書を削除しますか？")) return;
      deleteInvoice(id);
      refreshInvoices();
    },
    [refreshInvoices],
  );

  const handleCopyToCost = useCallback((invoice: Invoice) => {
    const entry = invoiceToCostEntry(invoice);
    // Copy JSON to clipboard so user can paste into cost management
    void navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => {
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleFormChange = useCallback(
    (field: keyof typeof EMPTY_FORM, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    const amountNum = Number(form.amount.replace(/,/g, ""));
    const taxNum = Number(form.tax.replace(/,/g, ""));
    if (!form.vendorName.trim()) {
      setSaveError("業者名を入力してください");
      return;
    }
    if (!form.invoiceDate) {
      setSaveError("請求日を入力してください");
      return;
    }
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setSaveError("金額を正しく入力してください");
      return;
    }
    setSaving(true);
    try {
      addInvoice({
        projectId: formProjectId,
        vendorName: form.vendorName.trim(),
        vendorContact: form.vendorContact.trim() || undefined,
        amount: amountNum,
        tax: taxNum,
        total: amountNum + taxNum,
        items: [],
        bankInfo: form.bankInfo.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        status: "未確認",
        pdfPath: form.pdfPath.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      refreshInvoices();
    } finally {
      setSaving(false);
    }
  }, [form, formProjectId, refreshInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">請求書管理</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "閉じる" : "+ 請求書登録"}
        </button>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">未払い合計</p>
          <p className="mt-1 text-xl font-bold text-red-600">{formatCurrency(summary.unpaidTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">今月支払予定</p>
          <p className="mt-1 text-xl font-bold text-orange-600">{formatCurrency(summary.thisMonthDueTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">今月支払済み</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(summary.paidTotal)}</p>
        </div>
      </div>

      {/* Registration Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-700">請求書登録</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">案件</label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {projects.length === 0 && <option value="">案件なし</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">業者名 *</label>
              <input
                type="text"
                value={form.vendorName}
                onChange={(e) => handleFormChange("vendorName", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="田中工務店"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">担当者</label>
              <input
                type="text"
                value={form.vendorContact}
                onChange={(e) => handleFormChange("vendorContact", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="田中太郎"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">金額 (税抜) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => handleFormChange("amount", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="100000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">消費税</label>
              <input
                type="number"
                value={form.tax}
                onChange={(e) => handleFormChange("tax", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">請求日 *</label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => handleFormChange("invoiceDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">支払期日</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => handleFormChange("dueDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">登録番号</label>
              <input
                type="text"
                value={form.registrationNumber}
                onChange={(e) => handleFormChange("registrationNumber", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="T1234567890123"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">振込先</label>
              <input
                type="text"
                value={form.bankInfo}
                onChange={(e) => handleFormChange("bankInfo", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="三菱UFJ銀行 渋谷支店"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">PDFパス (OCR取込)</label>
              <input
                type="text"
                value={form.pdfPath}
                onChange={(e) => handleFormChange("pdfPath", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="/invoices/invoice_001.pdf"
              />
            </div>
          </div>
          {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "登録中..." : "登録"}
            </button>
            <button
              onClick={() => { setShowForm(false); setSaveError(null); setForm(EMPTY_FORM); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Payment Calendar */}
      {thisMonthSchedule.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h2 className="mb-3 font-semibold text-orange-800">今月の支払い予定</h2>
          <ul className="space-y-2">
            {thisMonthSchedule.map((entry) => (
              <li
                key={entry.invoice.id}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{entry.invoice.vendorName}</span>
                <span className="text-slate-500">{entry.scheduledDate}</span>
                <span className="font-medium text-orange-700">{formatCurrency(entry.invoice.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["全部", ...STATUS_OPTIONS] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          請求書がありません
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((inv) => {
            const project = projects.find((p) => p.id === inv.projectId);
            return (
              <div
                key={inv.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{inv.vendorName}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {project ? project.name : inv.projectId} | 請求日: {inv.invoiceDate}
                      {inv.dueDate && ` | 期日: ${inv.dueDate}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-slate-800">{formatCurrency(inv.total)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={inv.status}
                    onChange={(e) => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleCopyToCost(inv)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {copiedId === inv.id ? "コピー済" : "経費コピー"}
                  </button>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
