import type { Repository } from "../domain/repository.js";
import type { BaseEntity } from "../domain/types.js";
import { hasSupabaseEnv } from "./supabase-client.js";
import { InMemoryRepository } from "./in-memory-repository.js";
import { LocalStorageRepository } from "./local-storage-repository.js";
import { SupabaseRepository } from "./supabase-repository.js";

// In test mode, share one InMemoryRepository instance per table name so that
// test helpers and component instances operate on the same data store.
const testRepoCache = new Map<string, InMemoryRepository<BaseEntity>>();

export function createAppRepository<T extends BaseEntity>(
  tableName: string,
  _getOrganizationId?: () => string | null,
): Repository<T> {
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    if (!testRepoCache.has(tableName)) {
      testRepoCache.set(tableName, new InMemoryRepository<BaseEntity>());
    }
    return testRepoCache.get(tableName) as unknown as Repository<T>;
  }

  if (hasSupabaseEnv()) {
    return new SupabaseRepository<T>(tableName);
  }

  // Use localStorage for persistence across page reloads
  return new LocalStorageRepository<T>(tableName);
}
