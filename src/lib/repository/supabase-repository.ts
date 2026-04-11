import type { Repository } from './types.js';
import { supabase } from './supabase-client.js';

type SupabaseError = { message: string } | null;

function throwIfError(error: SupabaseError): void {
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Supabase を使った汎用リポジトリ。
 * Repository<T> インターフェースを実装し、テーブル名を受け取る。
 */
export class SupabaseRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly tableName: string) {}

  async getAll(): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*');
    throwIfError(error);
    return (data ?? []) as T[];
  }

  async getById(id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfError(error);
    return (data ?? null) as T | null;
  }

  async create(item: Omit<T, 'id'>): Promise<T> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(item as Record<string, unknown>)
      .select('*')
      .single();
    throwIfError(error);
    return data as T;
  }

  async update(id: string, item: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(item as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfError(error);
    if (!data) {
      throw new Error(`Entity with id "${id}" not found`);
    }
    return data as T;
  }

  async delete(id: string): Promise<void> {
    const { data, error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    throwIfError(error);
    if (!data) {
      throw new Error(`Entity with id "${id}" not found`);
    }
  }
}
