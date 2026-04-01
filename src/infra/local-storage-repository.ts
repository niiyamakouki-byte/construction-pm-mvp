import type { BaseEntity } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";

/**
 * Error thrown when localStorage quota is exceeded.
 * Callers can catch this to show a user-facing message.
 */
export class StorageQuotaError extends Error {
  constructor(key: string, cause?: unknown) {
    super(
      `ストレージの容量が不足しています (key: ${key})。不要なプロジェクトを削除するか、ブラウザのストレージを確認してください。`,
    );
    this.name = "StorageQuotaError";
    this.cause = cause;
  }
}

/**
 * localStorage-backed repository.
 * Data survives page reloads. Falls back to in-memory Map if localStorage is unavailable.
 */
export class LocalStorageRepository<T extends BaseEntity>
  implements Repository<T>
{
  private readonly key: string;
  /** In-memory fallback used when localStorage is completely unavailable */
  private fallbackStore: Map<string, T> | null = null;

  constructor(storageKey: string) {
    this.key = `genbahub:${storageKey}`;
  }

  /** Check if localStorage is available at all */
  private isLocalStorageAvailable(): boolean {
    try {
      const testKey = "__genbahub_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private readAll(): Map<string, T> {
    // If we already fell back to in-memory, use that
    if (this.fallbackStore) return this.fallbackStore;

    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return new Map();
      const arr: T[] = JSON.parse(raw);
      return new Map(arr.map((e) => [e.id, e]));
    } catch {
      return new Map();
    }
  }

  /**
   * Persist the store to localStorage.
   * Throws StorageQuotaError if the write fails due to quota limits,
   * so callers can inform the user instead of silently losing data.
   */
  private writeAll(store: Map<string, T>): void {
    // If localStorage is entirely unavailable, use in-memory fallback
    if (!this.isLocalStorageAvailable()) {
      this.fallbackStore = store;
      return;
    }

    try {
      localStorage.setItem(this.key, JSON.stringify([...store.values()]));
    } catch (err: unknown) {
      // Detect quota exceeded (DOMException name varies across browsers)
      const isDomException =
        err instanceof DOMException ||
        (err instanceof Error && err.name === "QuotaExceededError");
      if (isDomException) {
        throw new StorageQuotaError(this.key, err);
      }
      // For other unexpected errors, still throw so data loss is visible
      throw err;
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
