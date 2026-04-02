import type { Repository } from "../domain/repository.js";
import type { BaseEntity } from "../domain/types.js";
import { getSupabaseClient } from "./supabase-client.js";

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function toSnakeRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [camelToSnake(key), value]),
  );
}

function toCamelRecord<T>(input: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [snakeToCamel(key), value]),
  ) as T;
}

function normalizeError(error: { message: string } | null): Error {
  return new Error(error?.message ?? "Supabase operation failed");
}

export class SupabaseRepository<T extends BaseEntity>
  implements Repository<T>
{
  constructor(
    private readonly tableName: string,
    private readonly getOrganizationId?: () => string | null,
  ) {}

  async findById(id: string): Promise<T | null> {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw normalizeError(error);
    }

    return data ? toCamelRecord<T>(data as Record<string, unknown>) : null;
  }

  async findAll(): Promise<T[]> {
    const client = await getSupabaseClient();
    const { data, error } = await client.from(this.tableName).select("*").order("created_at", { ascending: true });

    if (error) {
      throw normalizeError(error);
    }

    return Array.isArray(data)
      ? data.map((row) => toCamelRecord<T>(row as Record<string, unknown>))
      : [];
  }

  async create(entity: T): Promise<T> {
    const client = await getSupabaseClient();
    const record = toSnakeRecord(entity as Record<string, unknown>);
    const orgId = this.getOrganizationId?.();
    if (orgId && !record.organization_id) {
      record.organization_id = orgId;
    }
    const { data, error } = await client.from(this.tableName).insert(record).select("*").single();
    if (error) {
      throw normalizeError(error);
    }
    return toCamelRecord<T>(data as Record<string, unknown>);
  }

  async update(id: string, fields: Partial<Omit<T, "id" | "createdAt">>): Promise<T | null> {
    const client = await getSupabaseClient();
    const { data, error } = await client.from(this.tableName).update(toSnakeRecord(fields as Record<string, unknown>)).eq("id", id).select("*").maybeSingle();
    if (error) {
      throw normalizeError(error);
    }
    return data ? toCamelRecord<T>(data as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const client = await getSupabaseClient();
    const { data, error } = await client.from(this.tableName).delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      throw normalizeError(error);
    }
    return Boolean(data);
  }
}
