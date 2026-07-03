/**
 * SafetyRepository — Sprint 61 Phase 2
 *
 * ky_activities (KY活動) と near_miss_reports (ヒヤリ・ハット) の async repository。
 * VITE_USE_SUPABASE=true で Supabase、それ以外はインメモリ。
 *
 * NOTE: 両テーブルとも organization_id 列があるが、レコード型ではプロジェクト固定スコープ
 * を持たないため organization_id は null で保存する（後段で RLS が制御）。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type KyActivityRecord = {
  id: string;
  date: string;
  participants: string[];
  hazards: string[];
  countermeasures: string[];
  createdAt: string;
};

export type NearMissSeverity = 'high' | 'medium' | 'low';

export type NearMissReportRecord = {
  id: string;
  datetime: string;
  location: string;
  description: string;
  severity: NearMissSeverity;
  causeAnalysis: string;
  countermeasure: string;
  createdAt: string;
};

// DB実スキーマ ky_activities: id, project_id, organization_id, activity_date, leader_name, hazards, countermeasures, target_zero, participants, created_at, updated_at
// DB実スキーマ near_miss_reports: id, project_id, organization_id, occurred_at, location, description, cause, countermeasure, severity, reporter_name, created_at, updated_at
type KyActivityRow = {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  activity_date: string;
  participants: string[];
  hazards: string[];
  countermeasures: string[];
  created_at: string;
};

type NearMissRow = {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  occurred_at: string;
  location: string;
  description: string;
  severity: NearMissSeverity;
  cause: string;
  countermeasure: string;
  created_at: string;
};

function rowToKy(row: KyActivityRow): KyActivityRecord {
  return {
    id: row.id,
    date: row.activity_date,
    participants: row.participants,
    hazards: row.hazards,
    countermeasures: row.countermeasures,
    createdAt: row.created_at,
  };
}

function kyToRow(r: KyActivityRecord): KyActivityRow {
  return {
    id: r.id,
    project_id: null,
    organization_id: null,
    activity_date: r.date,
    participants: r.participants,
    hazards: r.hazards,
    countermeasures: r.countermeasures,
    created_at: r.createdAt,
  };
}

function rowToNearMiss(row: NearMissRow): NearMissReportRecord {
  return {
    id: row.id,
    datetime: row.occurred_at,
    location: row.location,
    description: row.description,
    severity: row.severity,
    causeAnalysis: row.cause,
    countermeasure: row.countermeasure,
    createdAt: row.created_at,
  };
}

function nearMissToRow(r: NearMissReportRecord): NearMissRow {
  return {
    id: r.id,
    project_id: null,
    organization_id: null,
    occurred_at: r.datetime,
    location: r.location,
    description: r.description,
    severity: r.severity,
    cause: r.causeAnalysis,
    countermeasure: r.countermeasure,
    created_at: r.createdAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class SafetyRepository {
  private kyStore = new Map<string, KyActivityRecord>();
  private nmStore = new Map<string, NearMissReportRecord>();
  private supabaseKy: SupabaseRepository<KyActivityRow> | null;
  private supabaseNm: SupabaseRepository<NearMissRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseKy = enabled
      ? new SupabaseRepository<KyActivityRow>('ky_activities')
      : null;
    this.supabaseNm = enabled
      ? new SupabaseRepository<NearMissRow>('near_miss_reports')
      : null;
  }

  // ── ky_activities ──────────────────────────────────────────────────

  async getKyAsync(id: string): Promise<KyActivityRecord | null> {
    if (this.supabaseKy) {
      const row = await this.supabaseKy.getById(id);
      return row ? rowToKy(row) : null;
    }
    return this.kyStore.get(id) ?? null;
  }

  async listKyAsync(): Promise<KyActivityRecord[]> {
    if (this.supabaseKy) {
      const rows = await this.supabaseKy.getAll();
      return rows.map(rowToKy);
    }
    return [...this.kyStore.values()];
  }

  async saveKyAsync(record: KyActivityRecord): Promise<void> {
    if (this.supabaseKy) {
      const row = kyToRow(record);
      const existing = await this.supabaseKy.getById(record.id);
      if (existing) {
        await this.supabaseKy.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseKy.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<KyActivityRow, 'id'>);
      }
      return;
    }
    this.kyStore.set(record.id, { ...record });
  }

  async deleteKyAsync(id: string): Promise<boolean> {
    if (this.supabaseKy) {
      try {
        await this.supabaseKy.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.kyStore.delete(id);
  }

  // ── near_miss_reports ──────────────────────────────────────────────

  async getNearMissAsync(id: string): Promise<NearMissReportRecord | null> {
    if (this.supabaseNm) {
      const row = await this.supabaseNm.getById(id);
      return row ? rowToNearMiss(row) : null;
    }
    return this.nmStore.get(id) ?? null;
  }

  async listNearMissAsync(): Promise<NearMissReportRecord[]> {
    if (this.supabaseNm) {
      const rows = await this.supabaseNm.getAll();
      return rows.map(rowToNearMiss);
    }
    return [...this.nmStore.values()];
  }

  async saveNearMissAsync(record: NearMissReportRecord): Promise<void> {
    if (this.supabaseNm) {
      const row = nearMissToRow(record);
      const existing = await this.supabaseNm.getById(record.id);
      if (existing) {
        await this.supabaseNm.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseNm.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<NearMissRow, 'id'>);
      }
      return;
    }
    this.nmStore.set(record.id, { ...record });
  }

  async deleteNearMissAsync(id: string): Promise<boolean> {
    if (this.supabaseNm) {
      try {
        await this.supabaseNm.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.nmStore.delete(id);
  }
}
