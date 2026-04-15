/**
 * TaskRepository — Phase A
 * 同期メソッド + async エイリアス（Promise.resolve ラッパー）
 */

export type Task = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  progress: number;
  startDate?: string;
  dueDate?: string;
  contractorId?: string;
  isMilestone: boolean;
  createdAt: string;
  updatedAt: string;
};

export class TaskRepository {
  private store = new Map<string, Task>();

  // ── 同期メソッド（既存互換）──────────────────────────────────────────────

  get(id: string): Task | null {
    return this.store.get(id) ?? null;
  }

  list(): Task[] {
    return [...this.store.values()];
  }

  listByProject(projectId: string): Task[] {
    return this.list().filter((t) => t.projectId === projectId);
  }

  save(task: Task): void {
    this.store.set(task.id, { ...task });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async エイリアス（Phase A: Supabase 移行対応可能）──────────────────

  async getAsync(id: string): Promise<Task | null> {
    return Promise.resolve(this.get(id));
  }

  async listAsync(): Promise<Task[]> {
    return Promise.resolve(this.list());
  }

  async listByProjectAsync(projectId: string): Promise<Task[]> {
    return Promise.resolve(this.listByProject(projectId));
  }

  async saveAsync(task: Task): Promise<void> {
    return Promise.resolve(this.save(task));
  }

  async deleteAsync(id: string): Promise<boolean> {
    return Promise.resolve(this.delete(id));
  }
}
