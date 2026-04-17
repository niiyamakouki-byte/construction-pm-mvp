/**
 * PhotoRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）
 */

export type PhotoRecord = {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
  url: string;
  takenAt?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
};

export class PhotoRepository {
  private store = new Map<string, PhotoRecord>();

  // ── async メソッド ──────────────────────────────────────────────────────

  async getAsync(id: string): Promise<PhotoRecord | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async listAsync(): Promise<PhotoRecord[]> {
    return Promise.resolve([...this.store.values()]);
  }

  async listByProjectAsync(projectId: string): Promise<PhotoRecord[]> {
    return Promise.resolve([...this.store.values()].filter((p) => p.projectId === projectId));
  }

  async saveAsync(photo: PhotoRecord): Promise<void> {
    this.store.set(photo.id, { ...photo });
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(id));
  }
}
