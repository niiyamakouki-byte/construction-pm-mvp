/**
 * EstimateRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）
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

  // ── async メソッド ──────────────────────────────────────────────────────

  async getAsync(id: string): Promise<EstimateRecord | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async listAsync(): Promise<EstimateRecord[]> {
    return Promise.resolve([...this.store.values()]);
  }

  async listByProjectAsync(projectId: string): Promise<EstimateRecord[]> {
    return Promise.resolve([...this.store.values()].filter((e) => e.projectId === projectId));
  }

  async saveAsync(estimate: EstimateRecord): Promise<void> {
    this.store.set(estimate.id, { ...estimate });
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(id));
  }
}
