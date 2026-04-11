import type { Repository } from './types.js';

/**
 * 汎用インメモリリポジトリ。
 * 既存のインメモリストアをRepository interfaceでラップする。
 * テスト・プロトタイプ用。
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private store = new Map<string, T>();

  async getAll(): Promise<T[]> {
    return [...this.store.values()].map((e) => structuredClone(e));
  }

  async getById(id: string): Promise<T | null> {
    const entity = this.store.get(id);
    return entity ? structuredClone(entity) : null;
  }

  async create(item: Omit<T, 'id'>): Promise<T> {
    const id = crypto.randomUUID();
    const entity = { ...item, id } as T;
    this.store.set(id, structuredClone(entity));
    return structuredClone(entity);
  }

  async update(id: string, item: Partial<T>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Entity with id "${id}" not found`);
    }
    const updated = { ...existing, ...item, id } as T;
    this.store.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new Error(`Entity with id "${id}" not found`);
    }
    this.store.delete(id);
  }
}
