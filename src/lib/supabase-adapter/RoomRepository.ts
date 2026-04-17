/**
 * RoomRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
 */

export type RoomRecord = {
  id: string;
  projectId: string;
  name: string;
  floor?: number;
  area?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class RoomRepository {
  private store = new Map<string, RoomRecord>();

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  /** @deprecated Use getAsync instead. Will be removed in Phase C cleanup. */
  get(id: string): RoomRecord | null {
    return this.store.get(id) ?? null;
  }

  /** @deprecated Use listAsync instead. Will be removed in Phase C cleanup. */
  list(): RoomRecord[] {
    return [...this.store.values()];
  }

  /** @deprecated Use listByProjectAsync instead. Will be removed in Phase C cleanup. */
  listByProject(projectId: string): RoomRecord[] {
    return this.list().filter((r) => r.projectId === projectId);
  }

  /** @deprecated Use saveAsync instead. Will be removed in Phase C cleanup. */
  save(room: RoomRecord): void {
    this.store.set(room.id, { ...room });
  }

  /** @deprecated Use deleteAsync instead. Will be removed in Phase C cleanup. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<RoomRecord | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<RoomRecord[]> {
    return Promise.resolve(this.list());
  }

  async listByProjectAsync(projectId: string): Promise<RoomRecord[]> {
    return Promise.resolve(this.listByProject(projectId));
  }

  async saveAsync(room: RoomRecord): Promise<void> {
    return Promise.resolve(this.save(room));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
