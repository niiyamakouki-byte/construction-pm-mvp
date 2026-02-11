import type { BaseEntity } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";

/** Map ベースのインメモリリポジトリ。テスト・プロトタイプ用。 */
export class InMemoryRepository<T extends BaseEntity>
  implements Repository<T>
{
  private store = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    const entity = this.store.get(id);
    return entity ? structuredClone(entity) : null;
  }

  async findAll(): Promise<T[]> {
    return [...this.store.values()].map((e) => structuredClone(e));
  }

  async create(entity: T): Promise<T> {
    if (this.store.has(entity.id)) {
      throw new Error(`Entity with id "${entity.id}" already exists`);
    }
    this.store.set(entity.id, structuredClone(entity));
    return structuredClone(entity);
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
    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
