import type { Repository } from "../domain/repository.js";
import type { BaseEntity } from "../domain/types.js";
import { withTimeout } from "./request-timeout.js";
import { getSupabaseClient } from "./supabase-client.js";
import type { SupabaseClientLike } from "./supabase-client.js";

const SUPABASE_TIMEOUT_MS = 10000;

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

  private withOrganizationScope<Query extends { eq(column: string, value: unknown): Query }>(
    query: Query,
  ): Query {
    const orgId = this.getOrganizationId?.();
    return orgId ? query.eq("organization_id", orgId) : query;
  }

  private async runQuery<TResult>(
    actionLabel: string,
    execute: (client: SupabaseClientLike) => Promise<TResult>,
  ): Promise<TResult> {
    return withTimeout(
      (async () => {
        const client = await getSupabaseClient();
        return execute(client);
      })(),
      {
        label: `${this.tableName}.${actionLabel}`,
        timeoutMs: SUPABASE_TIMEOUT_MS,
      },
    );
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.runQuery("findById", async (client) =>
      this.withOrganizationScope(
        client
          .from(this.tableName)
          .select("*")
          .eq("id", id),
      ).maybeSingle(),
    );

    if (error) {
      throw normalizeError(error);
    }

    return data ? toCamelRecord<T>(data as Record<string, unknown>) : null;
  }

  async findAll(): Promise<T[]> {
    const { data, error } = await this.runQuery("findAll", async (client) =>
      this.withOrganizationScope(
        client.from(this.tableName).select("*"),
      ).order("created_at", { ascending: true }),
    );

    if (error) {
      throw normalizeError(error);
    }

    return Array.isArray(data)
      ? data.map((row) => toCamelRecord<T>(row as Record<string, unknown>))
      : [];
  }

  async create(entity: T): Promise<T> {
    const record = toSnakeRecord(entity as Record<string, unknown>);
    const orgId = this.getOrganizationId?.();
    if (orgId && !record.organization_id) {
      record.organization_id = orgId;
    }
    const { data, error } = await this.runQuery("create", async (client) =>
      client.from(this.tableName).insert(record).select("*").single(),
    );
    if (error) {
      throw normalizeError(error);
    }
    return toCamelRecord<T>(data as Record<string, unknown>);
  }

  async update(id: string, fields: Partial<Omit<T, "id" | "createdAt">>): Promise<T | null> {
    const { data, error } = await this.runQuery("update", async (client) =>
      this.withOrganizationScope(
        client
          .from(this.tableName)
          .update(toSnakeRecord(fields as Record<string, unknown>))
          .eq("id", id),
      )
        .select("*")
        .maybeSingle(),
    );
    if (error) {
      throw normalizeError(error);
    }
    return data ? toCamelRecord<T>(data as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.runQuery("delete", async (client) =>
      this.withOrganizationScope(
        client
          .from(this.tableName)
          .delete()
          .eq("id", id),
      )
        .select("id")
        .maybeSingle(),
    );
    if (error) {
      throw normalizeError(error);
    }
    return Boolean(data);
  }
}
