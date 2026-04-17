/**
 * CostMasterRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
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

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  /** @deprecated Use getAsync instead. Will be removed in Phase C cleanup. */
  get(id: string): CostMasterItem | null {
    return this.store.get(id) ?? null;
  }

  /** @deprecated Use listAsync instead. Will be removed in Phase C cleanup. */
  list(): CostMasterItem[] {
    return [...this.store.values()];
  }

  /** @deprecated Use listByCategoryAsync instead. Will be removed in Phase C cleanup. */
  listByCategory(category: string): CostMasterItem[] {
    return this.list().filter((c) => c.category === category);
  }

  /** @deprecated Use saveAsync instead. Will be removed in Phase C cleanup. */
  save(item: CostMasterItem): void {
    this.store.set(item.id, { ...item });
  }

  /** @deprecated Use deleteAsync instead. Will be removed in Phase C cleanup. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<CostMasterItem | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<CostMasterItem[]> {
    return Promise.resolve(this.list());
  }

  async listByCategoryAsync(category: string): Promise<CostMasterItem[]> {
    return Promise.resolve(this.listByCategory(category));
  }

  async saveAsync(item: CostMasterItem): Promise<void> {
    return Promise.resolve(this.save(item));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
