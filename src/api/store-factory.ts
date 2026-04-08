import { resolve } from "node:path";
import { SupabaseStore, type SupabaseClientLike } from "./supabase-store.js";
import { JsonFileApiStore } from "./store.js";
import type { ApiStore } from "./types.js";

type StoreFactoryOptions = {
  dataFilePath?: string;
  env?: NodeJS.ProcessEnv;
  supabaseClient?: SupabaseClientLike;
};

function isSupabaseEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

export function createApiStore(options: StoreFactoryOptions = {}): ApiStore {
  const env = options.env ?? process.env;

  if (isSupabaseEnabled(env.USE_SUPABASE)) {
    return new SupabaseStore({
      client: options.supabaseClient,
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY,
      anonKey: env.SUPABASE_ANON_KEY,
    });
  }

  return new JsonFileApiStore(
    options.dataFilePath ??
      env.GENBAHUB_API_DB_FILE ??
      resolve(process.cwd(), ".genbahub-api-db.json"),
  );
}

export { isSupabaseEnabled };
