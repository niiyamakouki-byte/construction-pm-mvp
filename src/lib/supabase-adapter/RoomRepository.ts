/**
 * RoomRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）
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

  // ── async メソッド ──────────────────────────────────────────────────────

  async getAsync(id: string): Promise<RoomRecord | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async listAsync(): Promise<RoomRecord[]> {
    return Promise.resolve([...this.store.values()]);
  }

  async listByProjectAsync(projectId: string): Promise<RoomRecord[]> {
    return Promise.resolve([...this.store.values()].filter((r) => r.projectId === projectId));
  }

  async saveAsync(room: RoomRecord): Promise<void> {
    this.store.set(room.id, { ...room });
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(id));
  }
}
