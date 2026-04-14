/**
 * Electronic contract with embedded finance — KROX蒸留
 * Combines estimate items, e-contracts, and installment payment proposals.
 * Increasing conversion for renovation projects by showing payment options at estimate time.
 */
import { escapeHtml } from "./utils/escape-html";
import { createRepository } from "./repository/index.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled";

export type PaymentPlanType =
  | "lump_sum"
  | "installment_2"
  | "installment_3"
  | "installment_monthly";

export type PaymentInstallment = {
  dueDate: Date;
  amount: number;
  description: string;
};

export type PaymentPlan = {
  type: PaymentPlanType;
  downPaymentRate: number;
  installments: PaymentInstallment[];
  totalAmount: number;
  interestRate: number;
};

export type ContractLineItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

export type ElectronicContract = {
  id: string;
  projectId: string;
  clientName: string;
  clientEmail: string;
  contractorName: string;
  items: ContractLineItem[];
  subtotal: number;
  taxAmount: number;
  totalWithTax: number;
  paymentPlan: PaymentPlan;
  status: ContractStatus;
  constructionPeriod: { start: Date; end: Date };
  warrantyMonths: number;
  specialConditions: string[];
  signedAt?: Date;
  signedByClient?: string;
  sentAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
};

export type ContractTemplate = {
  id: string;
  name: string;
  category: "interior" | "exterior" | "renovation" | "new_build";
  defaultWarrantyMonths: number;
  defaultSpecialConditions: string[];
  requiredFields: string[];
};

// ── In-memory store ──────────────────────────────────────────────────────────

const store: Map<string, ElectronicContract> = new Map();
let nextId = 1;

export function clearEContracts(): void {
  store.clear();
  nextId = 1;
}

// ── Tax constant ─────────────────────────────────────────────────────────────

const TAX_RATE = 0.1; // 消費税10%

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Create an electronic contract with auto-calculated tax (10%).
 * Construction period defaults to [today, today+30days].
 */
export function createContract(
  projectId: string,
  clientName: string,
  clientEmail: string,
  contractorName: string,
  items: ContractLineItem[],
  paymentPlan: PaymentPlan,
  options: {
    constructionPeriod?: { start: Date; end: Date };
    warrantyMonths?: number;
    specialConditions?: string[];
  } = {},
): ElectronicContract {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE);
  const totalWithTax = subtotal + taxAmount;

  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 30);

  const contract: ElectronicContract = {
    id: `ecf-${nextId++}`,
    projectId,
    clientName,
    clientEmail,
    contractorName,
    items,
    subtotal,
    taxAmount,
    totalWithTax,
    paymentPlan,
    status: "draft",
    constructionPeriod: options.constructionPeriod ?? { start: now, end: defaultEnd },
    warrantyMonths: options.warrantyMonths ?? 12,
    specialConditions: options.specialConditions ?? [],
    createdAt: now,
  };
  store.set(contract.id, contract);
  return contract;
}

// ── Templates ────────────────────────────────────────────────────────────────

/**
 * Built-in contract templates for common renovation/construction types.
 */
export function getContractTemplates(): ContractTemplate[] {
  return [
    {
      id: "tmpl-interior",
      name: "内装工事請負契約書",
      category: "interior",
      defaultWarrantyMonths: 12,
      defaultSpecialConditions: [
        "追加工事が発生した場合は、書面にて別途合意の上実施するものとします。",
        "瑕疵担保責任期間は引渡し日より1年間とします。",
        "反社会的勢力排除条項に同意することを本契約締結の条件とします。",
      ],
      requiredFields: ["clientName", "clientEmail", "contractorName", "items", "paymentPlan"],
    },
    {
      id: "tmpl-renovation",
      name: "リフォーム工事契約書",
      category: "renovation",
      defaultWarrantyMonths: 24,
      defaultSpecialConditions: [
        "追加工事が発生した場合は、書面にて別途合意の上実施するものとします。",
        "瑕疵担保責任期間は引渡し日より2年間とします。",
        "反社会的勢力排除条項に同意することを本契約締結の条件とします。",
        "既存建物の隠れた瑕疵については、発見時点で速やかに協議するものとします。",
      ],
      requiredFields: ["clientName", "clientEmail", "contractorName", "items", "paymentPlan"],
    },
    {
      id: "tmpl-exterior",
      name: "外装・外壁工事契約書",
      category: "exterior",
      defaultWarrantyMonths: 36,
      defaultSpecialConditions: [
        "防水工事の瑕疵担保責任期間は引渡し日より3年間とします。",
        "塗装工事の瑕疵担保責任期間は引渡し日より2年間とします。",
        "追加工事が発生した場合は、書面にて別途合意の上実施するものとします。",
        "反社会的勢力排除条項に同意することを本契約締結の条件とします。",
      ],
      requiredFields: ["clientName", "clientEmail", "contractorName", "items", "paymentPlan"],
    },
  ];
}

// ── Payment plan generation ──────────────────────────────────────────────────

/**
 * Calculate monthly installment amount with compound interest.
 * Returns the monthly payment including interest.
 */
export function calculateMonthlyPayment(
  totalAmount: number,
  months: number,
  annualRate: number,
): number {
  if (months <= 0) return totalAmount;
  if (annualRate === 0) return Math.round(totalAmount / months);
  const monthlyRate = annualRate / 12;
  const payment =
    (totalAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(payment);
}

/**
 * Generate a payment plan for a given total amount, plan type, and start date.
 *
 * - lump_sum:          着工時100%
 * - installment_2:     着工時50% + 完工時50%
 * - installment_3:     契約時30% + 中間30% + 完工時40%
 * - installment_monthly: 均等月払い (金利1.5%/年)
 */
export function generatePaymentPlan(
  totalWithTax: number,
  planType: PaymentPlanType,
  startDate: Date,
  endDate?: Date,
): PaymentPlan {
  const end = endDate ?? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  switch (planType) {
    case "lump_sum": {
      return {
        type: "lump_sum",
        downPaymentRate: 1.0,
        installments: [
          {
            dueDate: startDate,
            amount: totalWithTax,
            description: "着工時一括払い",
          },
        ],
        totalAmount: totalWithTax,
        interestRate: 0,
      };
    }

    case "installment_2": {
      const half = Math.round(totalWithTax / 2);
      const remainder = totalWithTax - half;
      return {
        type: "installment_2",
        downPaymentRate: 0.5,
        installments: [
          {
            dueDate: startDate,
            amount: half,
            description: "着工時 (50%)",
          },
          {
            dueDate: end,
            amount: remainder,
            description: "完工時 (50%)",
          },
        ],
        totalAmount: totalWithTax,
        interestRate: 0,
      };
    }

    case "installment_3": {
      const first = Math.round(totalWithTax * 0.3);
      const second = Math.round(totalWithTax * 0.3);
      const third = totalWithTax - first - second;
      const midDate = new Date((startDate.getTime() + end.getTime()) / 2);
      return {
        type: "installment_3",
        downPaymentRate: 0.3,
        installments: [
          {
            dueDate: startDate,
            amount: first,
            description: "契約時 (30%)",
          },
          {
            dueDate: midDate,
            amount: second,
            description: "中間時 (30%)",
          },
          {
            dueDate: end,
            amount: third,
            description: "完工時 (40%)",
          },
        ],
        totalAmount: totalWithTax,
        interestRate: 0,
      };
    }

    case "installment_monthly": {
      const annualRate = 0.015; // 1.5%/年
      const durationMonths = Math.max(
        1,
        Math.round((end.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)),
      );
      const monthly = calculateMonthlyPayment(totalWithTax, durationMonths, annualRate);
      const installments: PaymentInstallment[] = [];
      for (let i = 0; i < durationMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        installments.push({
          dueDate,
          amount: i === durationMonths - 1 ? totalWithTax + Math.round(totalWithTax * annualRate * (durationMonths / 12)) - monthly * (durationMonths - 1) : monthly,
          description: `第${i + 1}回 月払い`,
        });
      }
      const totalPaid = installments.reduce((sum, p) => sum + p.amount, 0);
      return {
        type: "installment_monthly",
        downPaymentRate: 0,
        installments,
        totalAmount: totalPaid,
        interestRate: annualRate,
      };
    }
  }
}

/**
 * Generate all 4 payment plans for comparison.
 */
export function comparePaymentPlans(
  totalWithTax: number,
  startDate: Date,
  endDate: Date,
): PaymentPlan[] {
  const types: PaymentPlanType[] = [
    "lump_sum",
    "installment_2",
    "installment_3",
    "installment_monthly",
  ];
  return types.map((t) => generatePaymentPlan(totalWithTax, t, startDate, endDate));
}

// ── Status transitions ───────────────────────────────────────────────────────

/**
 * Send a contract: set status to 'sent', record sentAt, set expiresAt 30 days out.
 */
export function sendContract(contract: ElectronicContract): ElectronicContract {
  if (contract.status !== "draft") {
    throw new Error(`Cannot send contract in status: ${contract.status}`);
  }
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const updated: ElectronicContract = {
    ...contract,
    status: "sent",
    sentAt: now,
    expiresAt,
  };
  store.set(updated.id, updated);
  return updated;
}

/**
 * Sign a contract: set status to 'signed', record signedAt and client signature.
 */
export function signContract(
  contract: ElectronicContract,
  clientSignature: string,
): ElectronicContract {
  if (contract.status !== "sent" && contract.status !== "viewed") {
    throw new Error(`Cannot sign contract in status: ${contract.status}`);
  }
  const updated: ElectronicContract = {
    ...contract,
    status: "signed",
    signedAt: new Date(),
    signedByClient: clientSignature,
  };
  store.set(updated.id, updated);
  return updated;
}

/**
 * Find contracts expiring within the next 7 days (from referenceDate, default now).
 */
export function checkContractExpiry(
  contracts: ElectronicContract[],
  referenceDate?: Date,
): ElectronicContract[] {
  const ref = referenceDate ?? new Date();
  const sevenDaysLater = new Date(ref);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  return contracts.filter((c) => {
    if (c.status !== "sent" && c.status !== "viewed") return false;
    if (!c.expiresAt) return false;
    return c.expiresAt >= ref && c.expiresAt <= sevenDaysLater;
  });
}

// ── HTML document generation ─────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatCurrency(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/**
 * Build a printable A4 HTML contract document with payment schedule, signature blocks, and terms.
 */
export function buildContractHtml(contract: ElectronicContract): string {
  const itemRows = contract.items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td style="text-align:right">${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td style="text-align:right">${formatCurrency(item.unitPrice)}</td>
      <td style="text-align:right">${formatCurrency(item.amount)}</td>
    </tr>`,
    )
    .join("\n");

  const paymentRows = contract.paymentPlan.installments
    .map(
      (inst) => `<tr>
      <td>${escapeHtml(inst.description)}</td>
      <td>${formatDate(inst.dueDate)}</td>
      <td style="text-align:right">${formatCurrency(inst.amount)}</td>
    </tr>`,
    )
    .join("\n");

  const conditionItems = contract.specialConditions
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; font-size: 12pt; margin: 20mm; }
  h1 { text-align: center; font-size: 18pt; margin-bottom: 20px; }
  h2 { font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #333; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; }
  th { background: #f5f5f5; }
  .totals { text-align: right; font-weight: bold; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-block { width: 45%; border: 1px solid #333; padding: 20px; min-height: 80px; }
  .notice { font-size: 10pt; color: #666; margin-top: 20px; }
  @media print { body { margin: 15mm; } }
</style>
</head>
<body>
<h1>工事請負契約書</h1>

<table>
  <tr><th>発注者（甲）</th><td>${escapeHtml(contract.clientName)} &lt;${escapeHtml(contract.clientEmail)}&gt;</td></tr>
  <tr><th>受注者（乙）</th><td>${escapeHtml(contract.contractorName)}</td></tr>
  <tr><th>工事期間</th><td>${formatDate(contract.constructionPeriod.start)} 〜 ${formatDate(contract.constructionPeriod.end)}</td></tr>
  <tr><th>瑕疵担保期間</th><td>引渡し日より ${escapeHtml(contract.warrantyMonths)} ヶ月</td></tr>
  <tr><th>作成日</th><td>${formatDate(contract.createdAt)}</td></tr>
</table>

<h2>工事内容・見積明細</h2>
<table>
  <thead>
    <tr><th>項目</th><th>数量</th><th>単位</th><th>単価</th><th>金額</th></tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
  <tfoot>
    <tr><td colspan="4" class="totals">小計</td><td style="text-align:right">${formatCurrency(contract.subtotal)}</td></tr>
    <tr><td colspan="4" class="totals">消費税（10%）</td><td style="text-align:right">${formatCurrency(contract.taxAmount)}</td></tr>
    <tr><td colspan="4" class="totals">合計（税込）</td><td style="text-align:right; font-weight:bold">${formatCurrency(contract.totalWithTax)}</td></tr>
  </tfoot>
</table>

<h2>支払いスケジュール</h2>
<table>
  <thead>
    <tr><th>内容</th><th>支払期日</th><th>金額</th></tr>
  </thead>
  <tbody>
    ${paymentRows}
  </tbody>
</table>

<h2>特記事項</h2>
<ol>
  ${conditionItems || "<li>特記事項なし</li>"}
</ol>

<h2>署名欄</h2>
<div class="signatures">
  <div class="sig-block">
    <p><strong>発注者（甲）</strong></p>
    <p>${escapeHtml(contract.clientName)}</p>
    <br>
    <p>署名日：${contract.signedAt ? formatDate(contract.signedAt) : "　　　年　　月　　日"}</p>
    <p>署名：${contract.signedByClient ? escapeHtml(contract.signedByClient) : "________________"}</p>
  </div>
  <div class="sig-block">
    <p><strong>受注者（乙）</strong></p>
    <p>${escapeHtml(contract.contractorName)}</p>
    <br>
    <p>署名日：　　　年　　月　　日</p>
    <p>署名：________________</p>
  </div>
</div>

<p class="notice">本契約書は電子的に作成されたものです。双方の電子署名をもって正式な契約書として効力を持ちます。</p>
</body>
</html>`;
}

/**
 * Build an HTML comparison table of all payment options for client presentation.
 */
export function buildPaymentComparisonHtml(plans: PaymentPlan[], projectName: string): string {
  const planLabels: Record<PaymentPlanType, string> = {
    lump_sum: "一括払い",
    installment_2: "2回分割",
    installment_3: "3回分割",
    installment_monthly: "月払い",
  };

  const cols = plans
    .map((p) => `<th>${escapeHtml(planLabels[p.type])}</th>`)
    .join("\n");

  const totalRow = plans
    .map((p) => `<td style="text-align:right; font-weight:bold">${formatCurrency(p.totalAmount)}</td>`)
    .join("\n");

  const interestRow = plans
    .map(
      (p) =>
        `<td style="text-align:right">${p.interestRate > 0 ? `${(p.interestRate * 100).toFixed(1)}%/年` : "なし"}</td>`,
    )
    .join("\n");

  const scheduleRows = (() => {
    const maxInstallments = Math.max(...plans.map((p) => p.installments.length));
    return Array.from({ length: maxInstallments }, (_, i) => {
      const cells = plans
        .map((p) => {
          const inst = p.installments[i];
          if (!inst) return "<td>—</td>";
          return `<td style="text-align:right">${escapeHtml(inst.description)}<br>${formatCurrency(inst.amount)}<br><small>${formatDate(inst.dueDate)}</small></td>`;
        })
        .join("\n");
      return `<tr><th>第${i + 1}回</th>${cells}</tr>`;
    }).join("\n");
  })();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; font-size: 12pt; margin: 20mm; }
  h1 { text-align: center; font-size: 16pt; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; }
  th { background: #f0f4ff; }
  .recommend { background: #fffbea; }
</style>
</head>
<body>
<h1>${escapeHtml(projectName)} — お支払いプランのご提案</h1>
<table>
  <thead>
    <tr>
      <th>項目</th>
      ${cols}
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>合計お支払額</th>
      ${totalRow}
    </tr>
    <tr>
      <th>金利</th>
      ${interestRow}
    </tr>
    ${scheduleRows}
  </tbody>
</table>
<p style="font-size:10pt;color:#666">※月払いは年利1.5%の分割払い手数料が発生します。一括・分割払いには手数料はかかりません。</p>
</body>
</html>`;
}

// ── CSV export ───────────────────────────────────────────────────────────────

/**
 * Export contract list to CSV string.
 */
export function exportContractCSV(contracts: ElectronicContract[]): string {
  const headers = [
    "ID",
    "プロジェクトID",
    "発注者",
    "受注者",
    "ステータス",
    "小計",
    "消費税",
    "合計（税込）",
    "支払いプラン",
    "作成日",
    "送付日",
    "署名日",
  ];

  const rows = contracts.map((c) => {
    const planLabels: Record<PaymentPlanType, string> = {
      lump_sum: "一括払い",
      installment_2: "2回分割",
      installment_3: "3回分割",
      installment_monthly: "月払い",
    };
    const escape = (v: unknown): string => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    return [
      escape(c.id),
      escape(c.projectId),
      escape(c.clientName),
      escape(c.contractorName),
      escape(c.status),
      escape(c.subtotal),
      escape(c.taxAmount),
      escape(c.totalWithTax),
      escape(planLabels[c.paymentPlan.type]),
      escape(c.createdAt.toISOString().slice(0, 10)),
      escape(c.sentAt?.toISOString().slice(0, 10) ?? ""),
      escape(c.signedAt?.toISOString().slice(0, 10) ?? ""),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// ── Analytics ────────────────────────────────────────────────────────────────

export type ContractStats = {
  totalCount: number;
  totalValue: number;
  byStatus: Record<ContractStatus, number>;
  avgContractValue: number;
  conversionRate: number; // signed / sent (including signed+viewed)
};

/**
 * Compute stats: total value, per-status counts, avg value, and conversion rate (signed/sent).
 */
export function getContractStats(contracts: ElectronicContract[]): ContractStats {
  const byStatus: Record<ContractStatus, number> = {
    draft: 0,
    sent: 0,
    viewed: 0,
    signed: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  };

  let totalValue = 0;
  for (const c of contracts) {
    byStatus[c.status]++;
    totalValue += c.totalWithTax;
  }

  const sentTotal = byStatus.sent + byStatus.viewed + byStatus.signed + byStatus.rejected + byStatus.expired;
  const conversionRate = sentTotal > 0 ? byStatus.signed / sentTotal : 0;

  return {
    totalCount: contracts.length,
    totalValue,
    byStatus,
    avgContractValue: contracts.length > 0 ? Math.round(totalValue / contracts.length) : 0,
    conversionRate,
  };
}

// Repository-pattern accessor (for gradual migration to Supabase)
export const contractRepository = createRepository<ElectronicContract>('contracts');
