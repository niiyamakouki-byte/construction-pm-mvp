type SupabaseRow = Record<string, unknown>;

type SupabaseQueryResult = {
  data: SupabaseRow | SupabaseRow[] | null;
  error: { message: string } | null;
};

type SupabaseQueryBuilder = {
  select(columns?: string): SupabaseQueryBuilder;
  insert(values: SupabaseRow | SupabaseRow[]): SupabaseQueryBuilder;
  update(values: SupabaseRow): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  single(): Promise<SupabaseQueryResult>;
  maybeSingle(): Promise<SupabaseQueryResult>;
  then<TResult1 = SupabaseQueryResult, TResult2 = never>(
    onfulfilled?: ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
};

type SupabaseClientLike = {
  from(table: string): SupabaseQueryBuilder;
};

type SupabaseModule = {
  createClient(url: string, anonKey: string): SupabaseClientLike;
};

let clientPromise: Promise<SupabaseClientLike> | null = null;

export function getSupabaseEnv() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim(),
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  };
}

export function hasSupabaseEnv(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}

export async function getSupabaseClient(): Promise<SupabaseClientLike> {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase environment variables are missing");
  }

  clientPromise ??= (async () => {
    const moduleName = "@supabase/supabase-js";
    const { createClient } = (await import(
      /* @vite-ignore */ moduleName
    )) as SupabaseModule;
    const { url, anonKey } = getSupabaseEnv();
    return createClient(url!, anonKey!);
  })();

  return clientPromise;
}
