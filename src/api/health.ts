import { createApiStore, isSupabaseEnabled } from "./store-factory.js";
import type { ApiStore } from "./types.js";

export type HealthPayload = {
  status: "ok" | "degraded";
  uptime: number;
  database: {
    provider: "supabase" | "json-file";
    connected: boolean;
    error?: string;
  };
};

type HealthOptions = {
  store?: ApiStore;
  env?: NodeJS.ProcessEnv;
  uptime?: number;
};

function getDatabaseProvider(env: NodeJS.ProcessEnv): "supabase" | "json-file" {
  return isSupabaseEnabled(env.USE_SUPABASE) ? "supabase" : "json-file";
}

function getProcessUptime(): number {
  if (typeof process === "undefined" || typeof process.uptime !== "function") {
    return 0;
  }

  return Number(process.uptime().toFixed(3));
}

export async function buildHealthPayload(options: HealthOptions = {}): Promise<HealthPayload> {
  const env = options.env ?? process.env;
  const provider = getDatabaseProvider(env);

  try {
    const store = options.store ?? createApiStore({ env });
    await store.listProjects();

    return {
      status: "ok",
      uptime: options.uptime ?? getProcessUptime(),
      database: {
        provider,
        connected: true,
      },
    };
  } catch (error) {
    return {
      status: "degraded",
      uptime: options.uptime ?? getProcessUptime(),
      database: {
        provider,
        connected: false,
        error: error instanceof Error ? error.message : "Unknown database error",
      },
    };
  }
}
