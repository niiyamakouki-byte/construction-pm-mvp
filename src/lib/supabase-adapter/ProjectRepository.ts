/**
 * ProjectRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
 * Phase B で async メソッドを Supabase 実装に差し替える。
 */

import type { StoreProject } from '../store.js';

export type { StoreProject as Project };

export class ProjectRepository {
  private store = new Map<string, StoreProject>();

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  get(id: string): StoreProject | null {
    return this.store.get(id) ?? null;
  }

  list(): StoreProject[] {
    return [...this.store.values()];
  }

  save(project: StoreProject): void {
    this.store.set(project.id, { ...project });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<StoreProject | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<StoreProject[]> {
    return Promise.resolve(this.list());
  }

  async saveAsync(project: StoreProject): Promise<void> {
    return Promise.resolve(this.save(project));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
