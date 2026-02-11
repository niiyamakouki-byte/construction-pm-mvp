import type { BaseEntity } from "./types.js";

/** ジェネリックCRUDリポジトリ。DB実装を差し替え可能にする。 */
export interface Repository<T extends BaseEntity> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(
    id: string,
    fields: Partial<Omit<T, "id" | "createdAt">>,
  ): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}
