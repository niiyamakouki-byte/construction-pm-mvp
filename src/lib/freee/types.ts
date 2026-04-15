/**
 * freee 会計 API 型定義（最小限）
 * 参考: https://developer.freee.co.jp/reference/accounting/reference
 */

// ── Company ─────────────────────────────────────────

export type Company = {
  id: number;
  name: string;
  name_kana?: string;
  display_name?: string;
  role: string;
};

// ── Deal (取引) ──────────────────────────────────────

export type DealType = "income" | "expense";
export type DealStatus = "unsettled" | "settled";

export type DealDetail = {
  id: number;
  account_item_id: number;
  tax_code: number;
  amount: number;
  description?: string;
  section_id?: number;
  item_id?: number;
  tag_ids?: number[];
};

export type Deal = {
  id: number;
  company_id: number;
  issue_date: string;          // "YYYY-MM-DD"
  due_date?: string;
  amount: number;
  due_amount?: number;
  type: DealType;
  partner_id?: number;
  partner_name?: string;
  ref_number?: string;
  status: DealStatus;
  details: DealDetail[];
};

export type DealInput = Omit<Deal, "id" | "company_id" | "due_amount" | "status">;

export type DealFilter = {
  type?: DealType;
  status?: DealStatus;
  partner_id?: number;
  start_issue_date?: string;   // "YYYY-MM-DD"
  end_issue_date?: string;
  offset?: number;
  limit?: number;
};

// ── Invoice (請求書) ─────────────────────────────────

export type InvoiceStatus =
  | "draft"
  | "applying"
  | "remanded"
  | "rejected"
  | "approved"
  | "unsubmitted"
  | "submitted";

export type InvoiceLineItem = {
  id: number;
  order: number;
  type: "normal" | "discount" | "text";
  qty?: number;
  unit?: string;
  unit_price?: number;
  amount: number;
  description?: string;
  tax_code: number;
};

export type Invoice = {
  id: number;
  company_id: number;
  issue_date: string;           // "YYYY-MM-DD"
  due_date?: string;
  invoice_number: string;
  title?: string;
  total_amount: number;
  total_vat: number;
  sub_total: number;
  booking_date?: string;
  description?: string;
  invoice_status: InvoiceStatus;
  partner_id?: number;
  partner_name?: string;
  invoice_lines: InvoiceLineItem[];
};

export type InvoiceFilter = {
  invoice_status?: InvoiceStatus;
  partner_id?: number;
  start_issue_date?: string;
  end_issue_date?: string;
  offset?: number;
  limit?: number;
};

// ── Wallet (口座) ────────────────────────────────────

export type WalletableType = "bank_account" | "credit_card" | "wallet";

export type Wallet = {
  id: number;
  name: string;
  type: WalletableType;
  bank_id?: number;
  bank_name?: string;
  bank_code?: string;
  branch_code?: string;
  account_number?: string;
  last_balance?: number;
  last_balance_date?: string;
};

// ── Partner (取引先) ─────────────────────────────────

export type Partner = {
  id: number;
  name: string;
  name_kana?: string;
  shortcut1?: string;
  shortcut2?: string;
  org_code?: number;
  long_name?: string;
  name_suffix?: string;
  email?: string;
  phone?: string;
  contact_name?: string;
  available: boolean;
};

// ── Item (品目) ──────────────────────────────────────

export type Item = {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  available: boolean;
};

// ── Section (部門) ───────────────────────────────────

export type Section = {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  available: boolean;
  indent_count?: number;
  parent_id?: number;
};

// ── API Response wrappers ────────────────────────────

export type CompaniesResponse = {
  companies: Company[];
};

export type DealsResponse = {
  deals: Deal[];
  meta: { total_count: number };
};

export type InvoicesResponse = {
  invoices: Invoice[];
};

export type WalletsResponse = {
  walletables: Wallet[];
};
