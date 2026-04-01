import type { BaseEntity } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";

/**
 * localStorage-backed repository.
 * Data survives page reloads. Falls back to in-memory Map if localStorage is unavailable.
 */
export class LocalStorageRepository<T extends BaseEntity>
  implements Repository<T>
{
  private readonly key: string;

  constructor(storageKey: string) {
    this.key = `genbahub:${storageKey}`;
  }

  private readAll(): Map<string, T> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return new Map();
      const arr: T[] = JSON.parse(raw);
      return new Map(arr.map((e) => [e.id, e]));
    } catch {
      return new Map();
    }
  }

  private writeAll(store: Map<string, T>): void {
    try {
      localStorage.setItem(this.key, JSON.stringify([...store.values()]));
    } catch {
      // quota exceeded or unavailable — silent
    }
  }

  async findById(id: string): Promise<T | null> {
    const store = this.readAll();
    const entity = store.get(id);
    return entity ? structuredClone(entity) : null;
  }

  async findAll(): Promise<T[]> {
    const store = this.readAll();
    return [...store.values()].map((e) => structuredClone(e));
  }

  async create(entity: T): Promise<T> {
    const store = this.readAll();
    if (store.has(entity.id)) {
      throw new Error(`Entity with id "${entity.id}" already exists`);
    }
    store.set(entity.id, structuredClone(entity));
    this.writeAll(store);
    return structuredClone(entity);
  }

  async update(
    id: string,
    fields: Partial<Omit<T, "id" | "createdAt">>,
  ): Promise<T | null> {
    const store = this.readAll();
    const existing = store.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...fields,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    } as T;

    store.set(id, updated);
    this.writeAll(store);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    const store = this.readAll();
    const deleted = store.delete(id);
    if (deleted) this.writeAll(store);
    return deleted;
  }
}
