import { describe, it, expect, beforeEach } from "vitest";
import {
  createContract,
  getContractTemplates,
  generatePaymentPlan,
  comparePaymentPlans,
  sendContract,
  signContract,
  checkContractExpiry,
  buildContractHtml,
  buildPaymentComparisonHtml,
  exportContractCSV,
  calculateMonthlyPayment,
  getContractStats,
  clearEContracts,
} from "../lib/e-contract-finance.js";
import type {
  ContractLineItem,
  ElectronicContract,
  PaymentPlan,
} from "../lib/e-contract-finance.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONTRACTOR = "株式会社ラポルタ";
const CLIENT_NAME = "田中 一郎";
const CLIENT_EMAIL = "tanaka@example.com";

const ITEMS: ContractLineItem[] = [
  { name: "LGS下地工事", quantity: 50, unit: "m2", unitPrice: 3000, amount: 150000 },
  { name: "クロス貼り", quantity: 50, unit: "m2", unitPrice: 1500, amount: 75000 },
];

const START = new Date("2026-05-01");
const END = new Date("2026-06-30");

function makePlan(): PaymentPlan {
  return generatePaymentPlan(247500, "installment_2", START, END);
}

function makeContract(overrides?: Partial<{
  clientName: string;
  clientEmail: string;
  contractorName: string;
  items: ContractLineItem[];
  plan: PaymentPlan;
}>): ElectronicContract {
  return createContract(
    "p-test",
    overrides?.clientName ?? CLIENT_NAME,
    overrides?.clientEmail ?? CLIENT_EMAIL,
    overrides?.contractorName ?? CONTRACTOR,
    overrides?.items ?? ITEMS,
    overrides?.plan ?? makePlan(),
  );
}

beforeEach(() => {
  clearEContracts();
});

// ── createContract ────────────────────────────────────────────────────────────

describe("createContract", () => {
  it("creates a contract in draft status", () => {
    const c = makeContract();
    expect(c.status).toBe("draft");
    expect(c.projectId).toBe("p-test");
  });

  it("auto-calculates subtotal, taxAmount and totalWithTax", () => {
    const c = makeContract();
    expect(c.subtotal).toBe(225000); // 150000 + 75000
    expect(c.taxAmount).toBe(22500); // 10%
    expect(c.totalWithTax).toBe(247500);
  });

  it("assigns id starting with ecf-", () => {
    const c = makeContract();
    expect(c.id).toMatch(/^ecf-\d+$/);
  });

  it("stores clientName and clientEmail correctly", () => {
    const c = makeContract();
    expect(c.clientName).toBe(CLIENT_NAME);
    expect(c.clientEmail).toBe(CLIENT_EMAIL);
  });

  it("defaults warrantyMonths to 12 when not specified", () => {
    const c = makeContract();
    expect(c.warrantyMonths).toBe(12);
  });

  it("accepts custom warrantyMonths and specialConditions", () => {
    const c = createContract("p-1", CLIENT_NAME, CLIENT_EMAIL, CONTRACTOR, ITEMS, makePlan(), {
      warrantyMonths: 24,
      specialConditions: ["追加工事あり"],
    });
    expect(c.warrantyMonths).toBe(24);
    expect(c.specialConditions).toContain("追加工事あり");
  });

  it("assigns incremental IDs for multiple contracts", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    expect(c1.id).not.toBe(c2.id);
  });
});

// ── getContractTemplates ──────────────────────────────────────────────────────

describe("getContractTemplates", () => {
  it("returns 3 built-in templates", () => {
    expect(getContractTemplates()).toHaveLength(3);
  });

  it("includes 内装工事請負契約書 with 12 months warranty", () => {
    const t = getContractTemplates().find((t) => t.name === "内装工事請負契約書");
    expect(t).toBeDefined();
    expect(t?.defaultWarrantyMonths).toBe(12);
    expect(t?.category).toBe("interior");
  });

  it("includes リフォーム工事契約書 with 24 months warranty", () => {
    const t = getContractTemplates().find((t) => t.name === "リフォーム工事契約書");
    expect(t?.defaultWarrantyMonths).toBe(24);
    expect(t?.category).toBe("renovation");
  });

  it("includes 外装・外壁工事契約書 with 36 months warranty", () => {
    const t = getContractTemplates().find((t) => t.name === "外装・外壁工事契約書");
    expect(t?.defaultWarrantyMonths).toBe(36);
    expect(t?.category).toBe("exterior");
  });

  it("templates include 反社排除 condition", () => {
    const templates = getContractTemplates();
    for (const t of templates) {
      const hasHansha = t.defaultSpecialConditions.some((c) => c.includes("反社"));
      expect(hasHansha).toBe(true);
    }
  });
});

// ── generatePaymentPlan ───────────────────────────────────────────────────────

describe("generatePaymentPlan — lump_sum", () => {
  it("single installment equal to totalWithTax", () => {
    const plan = generatePaymentPlan(247500, "lump_sum", START, END);
    expect(plan.type).toBe("lump_sum");
    expect(plan.installments).toHaveLength(1);
    expect(plan.installments[0].amount).toBe(247500);
    expect(plan.downPaymentRate).toBe(1.0);
    expect(plan.interestRate).toBe(0);
  });
});

describe("generatePaymentPlan — installment_2", () => {
  it("two installments summing to totalWithTax", () => {
    const plan = generatePaymentPlan(247500, "installment_2", START, END);
    expect(plan.installments).toHaveLength(2);
    const total = plan.installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBe(247500);
    expect(plan.downPaymentRate).toBe(0.5);
  });

  it("first installment due at startDate", () => {
    const plan = generatePaymentPlan(247500, "installment_2", START, END);
    expect(plan.installments[0].dueDate).toEqual(START);
  });

  it("second installment due at endDate", () => {
    const plan = generatePaymentPlan(247500, "installment_2", START, END);
    expect(plan.installments[1].dueDate).toEqual(END);
  });
});

describe("generatePaymentPlan — installment_3", () => {
  it("three installments summing to totalWithTax", () => {
    const plan = generatePaymentPlan(300000, "installment_3", START, END);
    expect(plan.installments).toHaveLength(3);
    const total = plan.installments.reduce((s, i) => s + i.amount, 0);
    expect(total).toBe(300000);
  });

  it("downPaymentRate is 0.3", () => {
    const plan = generatePaymentPlan(300000, "installment_3", START, END);
    expect(plan.downPaymentRate).toBe(0.3);
  });

  it("first installment is 30% of total", () => {
    const plan = generatePaymentPlan(300000, "installment_3", START, END);
    expect(plan.installments[0].amount).toBe(90000);
  });
});

describe("generatePaymentPlan — installment_monthly", () => {
  it("produces multiple monthly installments", () => {
    const plan = generatePaymentPlan(300000, "installment_monthly", START, END);
    expect(plan.installments.length).toBeGreaterThan(0);
  });

  it("applies interest rate of 1.5%/year", () => {
    const plan = generatePaymentPlan(300000, "installment_monthly", START, END);
    expect(plan.interestRate).toBe(0.015);
  });

  it("total paid >= original amount (interest adds cost)", () => {
    const plan = generatePaymentPlan(300000, "installment_monthly", START, END);
    expect(plan.totalAmount).toBeGreaterThanOrEqual(300000);
  });
});

// ── comparePaymentPlans ───────────────────────────────────────────────────────

describe("comparePaymentPlans", () => {
  it("returns 4 plans", () => {
    const plans = comparePaymentPlans(247500, START, END);
    expect(plans).toHaveLength(4);
  });

  it("returns one plan per type", () => {
    const plans = comparePaymentPlans(247500, START, END);
    const types = plans.map((p) => p.type);
    expect(types).toContain("lump_sum");
    expect(types).toContain("installment_2");
    expect(types).toContain("installment_3");
    expect(types).toContain("installment_monthly");
  });
});

// ── sendContract ──────────────────────────────────────────────────────────────

describe("sendContract", () => {
  it("transitions draft → sent and sets sentAt and expiresAt", () => {
    const c = makeContract();
    const sent = sendContract(c);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeDefined();
    expect(sent.expiresAt).toBeDefined();
  });

  it("expiresAt is approximately 30 days after sentAt", () => {
    const c = makeContract();
    const sent = sendContract(c);
    const diffMs = sent.expiresAt!.getTime() - sent.sentAt!.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("throws when contract is not in draft status", () => {
    const c = makeContract();
    const sent = sendContract(c);
    expect(() => sendContract(sent)).toThrow();
  });
});

// ── signContract ──────────────────────────────────────────────────────────────

describe("signContract", () => {
  it("transitions sent → signed with clientSignature", () => {
    const c = makeContract();
    const sent = sendContract(c);
    const signed = signContract(sent, "田中 一郎");
    expect(signed.status).toBe("signed");
    expect(signed.signedAt).toBeDefined();
    expect(signed.signedByClient).toBe("田中 一郎");
  });

  it("throws when contract is draft", () => {
    const c = makeContract();
    expect(() => signContract(c, "田中 一郎")).toThrow();
  });
});

// ── checkContractExpiry ───────────────────────────────────────────────────────

describe("checkContractExpiry", () => {
  it("returns contracts expiring within 7 days", () => {
    const c = makeContract();
    const sent = sendContract(c);
    // Manually set expiresAt to 3 days from now
    const ref = new Date("2026-05-01");
    const expiresAt = new Date("2026-05-04");
    const modified = { ...sent, expiresAt };
    const results = checkContractExpiry([modified], ref);
    expect(results).toHaveLength(1);
  });

  it("excludes contracts expiring more than 7 days away", () => {
    const c = makeContract();
    const sent = sendContract(c);
    const ref = new Date("2026-05-01");
    const expiresAt = new Date("2026-05-20"); // 19 days away
    const modified = { ...sent, expiresAt };
    const results = checkContractExpiry([modified], ref);
    expect(results).toHaveLength(0);
  });

  it("excludes signed contracts even if expiry is near", () => {
    const c = makeContract();
    const sent = sendContract(c);
    const signed = signContract(sent, "田中 一郎");
    const ref = new Date("2026-05-01");
    const expiresAt = new Date("2026-05-03");
    const modified = { ...signed, expiresAt };
    const results = checkContractExpiry([modified], ref);
    expect(results).toHaveLength(0);
  });
});

// ── buildContractHtml ─────────────────────────────────────────────────────────

describe("buildContractHtml", () => {
  it("returns valid HTML containing contract parties", () => {
    const c = makeContract();
    const html = buildContractHtml(c);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain(escapeHtmlSafe(CLIENT_NAME));
    expect(html).toContain(escapeHtmlSafe(CONTRACTOR));
  });

  it("includes item names and amounts", () => {
    const c = makeContract();
    const html = buildContractHtml(c);
    expect(html).toContain("LGS下地工事");
    expect(html).toContain("クロス貼り");
  });

  it("includes payment schedule", () => {
    const c = makeContract();
    const html = buildContractHtml(c);
    expect(html).toContain("支払いスケジュール");
    expect(html).toContain("着工時");
  });

  it("escapes HTML in clientName", () => {
    const c = makeContract({ clientName: "<script>alert(1)</script>" });
    const html = buildContractHtml(c);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes signature blocks", () => {
    const c = makeContract();
    const html = buildContractHtml(c);
    expect(html).toContain("署名欄");
    expect(html).toContain("発注者（甲）");
    expect(html).toContain("受注者（乙）");
  });
});

// ── buildPaymentComparisonHtml ────────────────────────────────────────────────

describe("buildPaymentComparisonHtml", () => {
  it("returns HTML with all plan types", () => {
    const plans = comparePaymentPlans(247500, START, END);
    const html = buildPaymentComparisonHtml(plans, "KDX南青山改装工事");
    expect(html).toContain("一括払い");
    expect(html).toContain("2回分割");
    expect(html).toContain("3回分割");
    expect(html).toContain("月払い");
  });

  it("includes project name", () => {
    const plans = comparePaymentPlans(247500, START, END);
    const html = buildPaymentComparisonHtml(plans, "KDX南青山改装工事");
    expect(html).toContain("KDX南青山改装工事");
  });

  it("escapes project name", () => {
    const plans = comparePaymentPlans(247500, START, END);
    const html = buildPaymentComparisonHtml(plans, "<工事名>");
    expect(html).not.toContain("<工事名>");
    expect(html).toContain("&lt;工事名&gt;");
  });
});

// ── exportContractCSV ─────────────────────────────────────────────────────────

describe("exportContractCSV", () => {
  it("returns CSV with header and one row per contract", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    const csv = exportContractCSV([c1, c2]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it("includes required column headers", () => {
    const csv = exportContractCSV([makeContract()]);
    expect(csv).toContain("ID");
    expect(csv).toContain("発注者");
    expect(csv).toContain("ステータス");
    expect(csv).toContain("合計（税込）");
  });

  it("includes correct contract status", () => {
    const c = makeContract();
    const csv = exportContractCSV([c]);
    expect(csv).toContain("draft");
  });

  it("quotes fields containing commas", () => {
    const c = createContract(
      "p-1",
      "田中, 花子",
      "comma@example.com",
      CONTRACTOR,
      ITEMS,
      makePlan(),
    );
    const csv = exportContractCSV([c]);
    expect(csv).toContain('"田中, 花子"');
  });

  it("returns header-only for empty array", () => {
    const csv = exportContractCSV([]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("ID");
  });

  it("quotes clientName starting with = to prevent formula injection", () => {
    const c = createContract(
      "p-1",
      "=HYPERLINK(\"http://evil.com\",\"click\")",
      "evil@example.com",
      CONTRACTOR,
      ITEMS,
      makePlan(),
    );
    const csv = exportContractCSV([c]);
    // The value must be wrapped in quotes so Excel does not execute it as a formula
    expect(csv).not.toMatch(/^=HYPERLINK/m);
    expect(csv).toContain('"=HYPERLINK');
  });
});

// ── calculateMonthlyPayment ───────────────────────────────────────────────────

describe("calculateMonthlyPayment", () => {
  it("returns totalAmount/months when rate is 0", () => {
    expect(calculateMonthlyPayment(120000, 12, 0)).toBe(10000);
  });

  it("returns higher payment than no-interest when rate > 0", () => {
    const withInterest = calculateMonthlyPayment(120000, 12, 0.015);
    const noInterest = 120000 / 12;
    expect(withInterest).toBeGreaterThan(noInterest);
  });

  it("rounds to integer", () => {
    const payment = calculateMonthlyPayment(100001, 7, 0.015);
    expect(Number.isInteger(payment)).toBe(true);
  });
});

// ── getContractStats ──────────────────────────────────────────────────────────

describe("getContractStats", () => {
  it("returns zero stats for empty array", () => {
    const stats = getContractStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.avgContractValue).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });

  it("counts contracts by status", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    const sent = sendContract(c2);
    const stats = getContractStats([c1, sent]);
    expect(stats.byStatus.draft).toBe(1);
    expect(stats.byStatus.sent).toBe(1);
  });

  it("calculates totalValue correctly", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    const stats = getContractStats([c1, c2]);
    expect(stats.totalValue).toBe(c1.totalWithTax + c2.totalWithTax);
  });

  it("calculates avgContractValue", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    const stats = getContractStats([c1, c2]);
    expect(stats.avgContractValue).toBe(Math.round((c1.totalWithTax + c2.totalWithTax) / 2));
  });

  it("calculates conversionRate as signed / sentTotal", () => {
    const c1 = makeContract();
    const sent1 = sendContract(c1);
    const signed1 = signContract(sent1, "田中 一郎");

    const c2 = makeContract();
    const sent2 = sendContract(c2);

    const stats = getContractStats([signed1, sent2]);
    // 1 signed out of 2 sent total
    expect(stats.conversionRate).toBeCloseTo(0.5, 5);
  });
});

// ── Helper (local escaping for test assertions) ───────────────────────────────

function escapeHtmlSafe(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
