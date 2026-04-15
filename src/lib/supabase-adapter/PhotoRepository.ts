/**
 * PhotoRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
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

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  get(id: string): PhotoRecord | null {
    return this.store.get(id) ?? null;
  }

  list(): PhotoRecord[] {
    return [...this.store.values()];
  }

  listByProject(projectId: string): PhotoRecord[] {
    return this.list().filter((p) => p.projectId === projectId);
  }

  save(photo: PhotoRecord): void {
    this.store.set(photo.id, { ...photo });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<PhotoRecord | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<PhotoRecord[]> {
    return Promise.resolve(this.list());
  }

  async listByProjectAsync(projectId: string): Promise<PhotoRecord[]> {
    return Promise.resolve(this.listByProject(projectId));
  }

  async saveAsync(photo: PhotoRecord): Promise<void> {
    return Promise.resolve(this.save(photo));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
