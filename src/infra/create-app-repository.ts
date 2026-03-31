import type { Repository } from "../domain/repository.js";
import type { BaseEntity } from "../domain/types.js";
import { hasSupabaseEnv } from "./supabase-client.js";
import { InMemoryRepository } from "./in-memory-repository.js";
import { SupabaseRepository } from "./supabase-repository.js";

export function createAppRepository<T extends BaseEntity>(
  tableName: string,
): Repository<T> {
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return new InMemoryRepository<T>();
  }

  return hasSupabaseEnv()
    ? new SupabaseRepository<T>(tableName)
    : new InMemoryRepository<T>();
}
