/**
 * EstimateRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）
 *
 * VITE_USE_SUPABASE=true のとき public.estimate_documents テーブルを使用。
 * false（既定）のとき InMemory 動作（ローカル開発・テスト用）。
 *
 * InMemory フォールバックは廃止。Supabase 未設定時はエラーを throw する。
 */

import { getSupabaseClient, hasSupabaseEnv } from '../../infra/supabase-client.js';

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

type DbEstimateDocument = {
  id: string;
  project_id: string;
  property_name: string;
  client_name: string;
  total_amount: number;
  tax_rate: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

function toRecord(row: DbEstimateDocument): EstimateRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    propertyName: row.property_name,
    clientName: row.client_name,
    totalAmount: row.total_amount,
    taxRate: row.tax_rate,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbRow(estimate: EstimateRecord): Omit<DbEstimateDocument, 'created_at' | 'updated_at'> {
  return {
    id: estimate.id,
    project_id: estimate.projectId,
    property_name: estimate.propertyName,
    client_name: estimate.clientName,
    total_amount: estimate.totalAmount,
    tax_rate: estimate.taxRate,
    status: estimate.status,
  };
}

export class EstimateRepository {
  private useSupabase: boolean;
  // InMemory ストア (VITE_USE_SUPABASE=false のローカル開発・Vitest 用)
  private store = new Map<string, EstimateRecord>();

  constructor(useSupabase?: boolean) {
    this.useSupabase = useSupabase ?? isSupabaseEnabled();

    if (this.useSupabase && !hasSupabaseEnv()) {
      throw new Error(
        '[EstimateRepository] VITE_USE_SUPABASE=true ですが Supabase 環境変数が未設定です。' +
        'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。'
      );
    }
  }

  // ── async メソッド ──────────────────────────────────────────────────────

  async getAsync(id: string): Promise<EstimateRecord | null> {
    if (!this.useSupabase) {
      return Promise.resolve(this.store.get(id) ?? null);
    }
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('estimate_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`EstimateRepository.getAsync: ${error.message}`);
    if (!data) return null;
    return toRecord(data as unknown as DbEstimateDocument);
  }

  async listAsync(): Promise<EstimateRecord[]> {
    if (!this.useSupabase) {
      return Promise.resolve([...this.store.values()]);
    }
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('estimate_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`EstimateRepository.listAsync: ${error.message}`);
    return ((data as unknown as DbEstimateDocument[]) ?? []).map(toRecord);
  }

  async listByProjectAsync(projectId: string): Promise<EstimateRecord[]> {
    if (!this.useSupabase) {
      return Promise.resolve([...this.store.values()].filter((e) => e.projectId === projectId));
    }
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('estimate_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`EstimateRepository.listByProjectAsync: ${error.message}`);
    return ((data as unknown as DbEstimateDocument[]) ?? []).map(toRecord);
  }

  async saveAsync(estimate: EstimateRecord): Promise<void> {
    if (!this.useSupabase) {
      this.store.set(estimate.id, { ...estimate });
      return;
    }
    const client = await getSupabaseClient();
    const row = toDbRow(estimate);
    const { error } = await client
      .from('estimate_documents')
      .insert(row as unknown as Record<string, unknown>);
    if (error) {
      // upsert: 既存レコードは update
      const { error: updateError } = await client
        .from('estimate_documents')
        .update(row as unknown as Record<string, unknown>)
        .eq('id', estimate.id);
      if (updateError) throw new Error(`EstimateRepository.saveAsync: ${updateError.message}`);
    }
  }

  async deleteAsync(id: string): Promise<boolean> {
    if (!this.useSupabase) {
      return Promise.resolve(this.store.delete(id));
    }
    const client = await getSupabaseClient();
    const { error } = await client
      .from('estimate_documents')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`EstimateRepository.deleteAsync: ${error.message}`);
    return true;
  }
}
