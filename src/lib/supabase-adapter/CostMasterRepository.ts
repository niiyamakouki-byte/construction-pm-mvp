/**
 * CostMasterRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）
 */

export type CostMasterItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  category: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export class CostMasterRepository {
  private store = new Map<string, CostMasterItem>();

  // ── async メソッド ──────────────────────────────────────────────────────

  async getAsync(id: string): Promise<CostMasterItem | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async listAsync(): Promise<CostMasterItem[]> {
    return Promise.resolve([...this.store.values()]);
  }

  async listByCategoryAsync(category: string): Promise<CostMasterItem[]> {
    return Promise.resolve([...this.store.values()].filter((c) => c.category === category));
  }

  async saveAsync(item: CostMasterItem): Promise<void> {
    this.store.set(item.id, { ...item });
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(id));
  }
}
