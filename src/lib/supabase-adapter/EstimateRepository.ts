/**
 * EstimateRepository — Phase B (限定対応)
 *
 * NOTE: DB スキーマ (public.estimates) は「明細行」単位
 *   (project_id, item_name, quantity, unit_price, category) であり、
 * 本リポジトリの EstimateRecord は「見積書」単位
 *   (propertyName, clientName, totalAmount, status, taxRate) と粒度が異なる。
 *
 * Phase B 時点では schema 整合が取れないため、useSupabase=true でも
 * async メソッドは InMemory のまま動作する（データ破損回避）。
 * Phase C で見積書レベル schema を追加した上で本格切替予定。
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

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

let warnedSchemaMismatch = false;

export class EstimateRepository {
  private store = new Map<string, EstimateRecord>();

  /**
   * @param useSupabase Phase B 時点では Supabase スキーマと粒度不一致のため
   * true 指定でも InMemory にフォールバック（一度だけ警告ログ）。
   * Phase C で見積書 schema 追加後に本切替予定。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    if (enabled && !warnedSchemaMismatch) {
      warnedSchemaMismatch = true;
      console.warn(
        '[EstimateRepository] VITE_USE_SUPABASE=true ですが、見積書スキーマが Phase C 待ちのため InMemory にフォールバックします',
      );
    }
  }

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
