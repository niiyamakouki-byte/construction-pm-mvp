/**
 * ContractorRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
 */

export type ContractorRecord = {
  id: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  contactPerson?: string;
  lineId?: string;
  createdAt: string;
  updatedAt: string;
};

export class ContractorRepository {
  private store = new Map<string, ContractorRecord>();

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  get(id: string): ContractorRecord | null {
    return this.store.get(id) ?? null;
  }

  list(): ContractorRecord[] {
    return [...this.store.values()];
  }

  save(contractor: ContractorRecord): void {
    this.store.set(contractor.id, { ...contractor });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<ContractorRecord | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<ContractorRecord[]> {
    return Promise.resolve(this.list());
  }

  async saveAsync(contractor: ContractorRecord): Promise<void> {
    return Promise.resolve(this.save(contractor));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
