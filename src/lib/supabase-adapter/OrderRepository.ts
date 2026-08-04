/**
 * OrderRepository — Phase C
 * async メソッドのみ。VITE_USE_SUPABASE=true のとき Supabase
 * (purchase_orders テーブル, migration 018 で拡張) へ、
 * それ以外はインメモリへルーティングする。
 * items は jsonb でまとめて保存する。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type PurchaseOrderStatus =
  | '下書き'
  | '発注済'
  | '納品待ち'
  | '納品済'
  | '検収済'
  | '請求済'
  | '支払済';

export type PurchaseOrderItemRecord = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type PurchaseOrderRecord = {
  id: string;
  projectId: string;
  contractorId: string;
  contractorName: string;
  items: PurchaseOrderItemRecord[];
  status: PurchaseOrderStatus;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  taxAmount: number;
  totalWithTax: number;
  notes?: string;
  /** 紐づく工程タスクID（票g0zed: ガント上に納期マーカーを表示するため） */
  taskId?: string;
  createdAt: string;
  updatedAt: string;
};

type PurchaseOrderRow = {
  id: string;
  project_id: string;
  organization_id?: string | null;
  supplier_name: string;
  contractor_id: string | null;
  contractor_name: string | null;
  order_number?: string | null;
  status: string;
  order_date: string | null;
  delivery_date: string | null;
  expected_date?: string | null;
  task_id?: string | null;
  items: PurchaseOrderItemRecord[] | null;
  total_amount: number | string | null;
  tax_amount: number | string | null;
  total_with_tax: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: PurchaseOrderRow): PurchaseOrderRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    contractorId: row.contractor_id ?? '',
    contractorName: row.contractor_name ?? row.supplier_name ?? '',
    items: Array.isArray(row.items) ? row.items : [],
    status: (row.status as PurchaseOrderStatus) ?? '下書き',
    orderDate: row.order_date ?? '',
    deliveryDate: row.delivery_date ?? row.expected_date ?? '',
    taskId: row.task_id ?? undefined,
    totalAmount: Number(row.total_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalWithTax: Number(row.total_with_tax ?? row.total_amount ?? 0),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(o: PurchaseOrderRecord): PurchaseOrderRow {
  return {
    id: o.id,
    project_id: o.projectId,
    supplier_name: o.contractorName,
    contractor_id: o.contractorId || null,
    contractor_name: o.contractorName || null,
    status: o.status,
    order_date: o.orderDate || null,
    delivery_date: o.deliveryDate || null,
    task_id: o.taskId || null,
    items: o.items,
    total_amount: o.totalAmount,
    tax_amount: o.taxAmount,
    total_with_tax: o.totalWithTax,
    notes: o.notes ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

// mt9d5: FreeeRepository(584095d)と同じくE2Eバイパス中はVITE_USE_SUPABASE=trueでも
// 実Supabaseへ問い合わせずインメモリへフォールバックする(初回セッション直行でスキーマ未整備エラーに詰まないため)。
function isE2EBypass(): boolean {
  return typeof window !== 'undefined' && (window as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ === true;
}

export class OrderRepository {
  private memory = new Map<string, PurchaseOrderRecord>();
  private supabase: SupabaseRepository<PurchaseOrderRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? (isSupabaseEnabled() && !isE2EBypass());
    this.supabase = enabled
      ? new SupabaseRepository<PurchaseOrderRow>('purchase_orders')
      : null;
  }

  async getAsync(id: string): Promise<PurchaseOrderRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToRecord(row) : null;
    }
    return this.memory.get(id) ?? null;
  }

  async listByProjectAsync(projectId: string): Promise<PurchaseOrderRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToRecord);
    }
    return [...this.memory.values()].filter((o) => o.projectId === projectId);
  }

  async saveAsync(order: PurchaseOrderRecord): Promise<void> {
    if (this.supabase) {
      const row = recordToRow(order);
      const existing = await this.supabase.getById(order.id);
      if (existing) {
        await this.supabase.update(order.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({
          ...rest,
          id: order.id,
        } as unknown as Omit<PurchaseOrderRow, 'id'>);
      }
      return;
    }
    this.memory.set(order.id, { ...order, items: [...order.items] });
  }

  async deleteAsync(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.memory.delete(id);
  }

  /** Test helper — clears in-memory state only. */
  _reset(): void {
    this.memory.clear();
  }
}

// 票g0zed: 発注(Orders画面)とガント(工程画面)は別ページから同じ受発注データを
// 参照する。非Supabaseモードの内部ストアはインスタンス毎に独立したMapなので、
// 別々に `new OrderRepository()` すると納期マーカーがガント側に反映されない。
// 両ページで同一インスタンスを共有するための既定シングルトン。
export const orderRepository = new OrderRepository();
