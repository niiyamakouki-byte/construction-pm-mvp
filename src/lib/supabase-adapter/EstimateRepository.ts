/**
 * EstimateRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
 */

export type EstimateRecord = {
  id: string;
  projectId: string;
  propertyName: string;
  clientName: string;
  totalAmount: number;
  taxRate: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export class EstimateRepository {
  private store = new Map<string, EstimateRecord>();

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  get(id: string): EstimateRecord | null {
    return this.store.get(id) ?? null;
  }

  list(): EstimateRecord[] {
    return [...this.store.values()];
  }

  listByProject(projectId: string): EstimateRecord[] {
    return this.list().filter((e) => e.projectId === projectId);
  }

  save(estimate: EstimateRecord): void {
    this.store.set(estimate.id, { ...estimate });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<EstimateRecord | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<EstimateRecord[]> {
    return Promise.resolve(this.list());
  }

  async listByProjectAsync(projectId: string): Promise<EstimateRecord[]> {
    return Promise.resolve(this.listByProject(projectId));
  }

  async saveAsync(estimate: EstimateRecord): Promise<void> {
    return Promise.resolve(this.save(estimate));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
