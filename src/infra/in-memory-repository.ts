import type { BaseEntity } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";

/** Map ベースのインメモリリポジトリ。テスト・プロトタイプ用。 */
export class InMemoryRepository<T extends BaseEntity>
  implements Repository<T>
{
  private store = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return [...this.store.values()];
  }

  async create(entity: T): Promise<T> {
    this.store.set(entity.id, entity);
    return entity;
  }

  async update(
    id: string,
    fields: Partial<Omit<T, "id" | "createdAt">>,
  ): Promise<T | null> {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...fields,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    } as T;

    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
