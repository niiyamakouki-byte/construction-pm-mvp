/**
 * CRMRepository — Phase A
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは現時点でインメモリにルーティング（Phase A）。
 * TODO: Phase B — VITE_USE_SUPABASE=true のとき Supabase へ切替
 */

export type CustomerRecord = {
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

export type DealRecord = {
  id: string;
  customerId: string;
  projectName: string;
  stage: DealStage;
  estimatedAmount: number;
  actualAmount: number | null;
  probability: number;
  expectedCloseDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export class CRMRepository {
  private customers = new Map<string, CustomerRecord>();
  private deals = new Map<string, DealRecord>();

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  getCustomer(id: string): CustomerRecord | null {
    return this.customers.get(id) ?? null;
  }

  listCustomers(): CustomerRecord[] {
    return [...this.customers.values()];
  }

  saveCustomer(customer: CustomerRecord): void {
    this.customers.set(customer.id, { ...customer });
  }

  deleteCustomer(id: string): boolean {
    return this.customers.delete(id);
  }

  getDeal(id: string): DealRecord | null {
    return this.deals.get(id) ?? null;
  }

  listDeals(): DealRecord[] {
    return [...this.deals.values()];
  }

  saveDeal(deal: DealRecord): void {
    this.deals.set(deal.id, { ...deal });
  }

  deleteDeal(id: string): boolean {
    return this.deals.delete(id);
  }

  // ── async メソッド（Phase A: インメモリエイリアス）────────────────────

  async getCustomerAsync(id: string): Promise<CustomerRecord | null> {
    return this.getCustomer(id);
  }

  async listCustomersAsync(): Promise<CustomerRecord[]> {
    return this.listCustomers();
  }

  async saveCustomerAsync(customer: CustomerRecord): Promise<void> {
    this.saveCustomer(customer);
  }

  async deleteCustomerAsync(id: string): Promise<boolean> {
    return this.deleteCustomer(id);
  }

  async getDealAsync(id: string): Promise<DealRecord | null> {
    return this.getDeal(id);
  }

  async listDealsAsync(): Promise<DealRecord[]> {
    return this.listDeals();
  }

  async saveDealAsync(deal: DealRecord): Promise<void> {
    this.saveDeal(deal);
  }

  async deleteDealAsync(id: string): Promise<boolean> {
    return this.deleteDeal(id);
  }
}
