/**
 * CRM store — customer and deal (pipeline) management.
 * Provides ANDPAD-style 引合粗利管理 functionality.
 */

export type Customer = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  createdAt: string;
};

export type DealStage = '引合' | '現調' | '見積提出' | '商談中' | '受注' | '失注';

export type Deal = {
  id: string;
  customerId: string;
  projectName: string;
  stage: DealStage;
  estimatedAmount: number;
  actualAmount: number | null;
  probability: number; // 0-100
  expectedCloseDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type PipelineSummary = {
  stage: DealStage;
  count: number;
  totalEstimated: number;
  weightedAmount: number;
};

export type CRMStats = {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  totalEstimated: number;
  totalActual: number;
  pipeline: PipelineSummary[];
};

// In-memory store
const customers: Map<string, Customer> = new Map();
const deals: Map<string, Deal> = new Map();

const STAGE_ORDER: DealStage[] = ['引合', '現調', '見積提出', '商談中', '受注', '失注'];

// --- Customer CRUD ---

export function addCustomer(customer: Customer): Customer {
  customers.set(customer.id, customer);
  return customer;
}

export function getCustomer(id: string): Customer | undefined {
  return customers.get(id);
}

export function updateCustomer(id: string, patch: Partial<Omit<Customer, 'id' | 'createdAt'>>): Customer | null {
  const customer = customers.get(id);
  if (!customer) return null;
  const updated = { ...customer, ...patch };
  customers.set(id, updated);
  return updated;
}

export function deleteCustomer(id: string): boolean {
  return customers.delete(id);
}

export function getAllCustomers(): Customer[] {
  return Array.from(customers.values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
}

export function searchCustomers(query: string): Customer[] {
  const q = query.toLowerCase();
  return getAllCustomers().filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q),
  );
}

// --- Deal CRUD ---

export function addDeal(deal: Deal): Deal {
  deals.set(deal.id, deal);
  return deal;
}

export function getDeal(id: string): Deal | undefined {
  return deals.get(id);
}

export function updateDeal(id: string, patch: Partial<Omit<Deal, 'id' | 'customerId' | 'createdAt'>>): Deal | null {
  const deal = deals.get(id);
  if (!deal) return null;
  const updated: Deal = {
    ...deal,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  deals.set(id, updated);
  return updated;
}

export function deleteDeal(id: string): boolean {
  return deals.delete(id);
}

export function getAllDeals(): Deal[] {
  return Array.from(deals.values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
}

export function getDealsByCustomer(customerId: string): Deal[] {
  return getAllDeals().filter((d) => d.customerId === customerId);
}

export function getDealsByStage(stage: DealStage): Deal[] {
  return getAllDeals().filter((d) => d.stage === stage);
}

// --- Stage transition ---

export function changeStage(dealId: string, stage: DealStage): Deal | null {
  return updateDeal(dealId, { stage });
}

// --- Pipeline aggregation ---

export function getPipelineSummary(): PipelineSummary[] {
  return STAGE_ORDER.map((stage) => {
    const stageDeals = getDealsByStage(stage);
    const totalEstimated = stageDeals.reduce((sum, d) => sum + d.estimatedAmount, 0);
    const weightedAmount = stageDeals.reduce(
      (sum, d) => sum + d.estimatedAmount * (d.probability / 100),
      0,
    );
    return { stage, count: stageDeals.length, totalEstimated, weightedAmount };
  });
}

export function getCRMStats(): CRMStats {
  const all = getAllDeals();
  const wonDeals = all.filter((d) => d.stage === '受注');
  const lostDeals = all.filter((d) => d.stage === '失注');
  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
  const totalEstimated = all.reduce((sum, d) => sum + d.estimatedAmount, 0);
  const totalActual = wonDeals.reduce((sum, d) => sum + (d.actualAmount ?? d.estimatedAmount), 0);

  return {
    totalDeals: all.length,
    wonDeals: wonDeals.length,
    lostDeals: lostDeals.length,
    winRate,
    totalEstimated,
    totalActual,
    pipeline: getPipelineSummary(),
  };
}

export function getStageOrder(): DealStage[] {
  return [...STAGE_ORDER];
}

/** Reset store (for testing) */
export function _resetCRMStore(): void {
  customers.clear();
  deals.clear();
}
