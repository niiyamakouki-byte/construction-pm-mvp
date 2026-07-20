/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { SupabaseStore, type SupabaseClientLike } from "./supabase-store.js";
import { JsonFileApiStore } from "./store.js";
import { createApiStore, isSupabaseEnabled } from "./store-factory.js";

function createUnusedClient(): SupabaseClientLike {
  return {
    from() {
      throw new Error("not used");
    },
  };
}

describe("createApiStore", () => {
  it("defaults to JsonFileApiStore", () => {
    const store = createApiStore({
      dataFilePath: "/tmp/genbahub-test.json",
      env: {} as NodeJS.ProcessEnv,
    });

    expect(store).toBeInstanceOf(JsonFileApiStore);
  });

  it("returns SupabaseStore when USE_SUPABASE is enabled", () => {
    const store = createApiStore({
      env: {
        USE_SUPABASE: "true",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      supabaseClient: createUnusedClient(),
    });

    expect(store).toBeInstanceOf(SupabaseStore);
  });

  it("falls back to SUPABASE_ANON_KEY for legacy envs", () => {
    const store = createApiStore({
      env: {
        USE_SUPABASE: "true",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
      },
      supabaseClient: createUnusedClient(),
    });

    expect(store).toBeInstanceOf(SupabaseStore);
  });

  it("throws when Supabase is enabled without required env", () => {
    expect(() =>
      createApiStore({
        env: {
          USE_SUPABASE: "1",
        },
      }),
    ).toThrow("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("isSupabaseEnabled", () => {
  it("accepts common truthy env values", () => {
    expect(isSupabaseEnabled("true")).toBe(true);
    expect(isSupabaseEnabled("1")).toBe(true);
    expect(isSupabaseEnabled("on")).toBe(true);
    expect(isSupabaseEnabled("yes")).toBe(true);
    expect(isSupabaseEnabled("false")).toBe(false);
    expect(isSupabaseEnabled(undefined)).toBe(false);
  });

  it("tolerates surrounding whitespace/newlines from env var registration", () => {
    // Vercel 本番の USE_SUPABASE が "true\n" で登録されていた実事故の回帰門番 (2026-07-21)
    expect(isSupabaseEnabled("true\n")).toBe(true);
    expect(isSupabaseEnabled(" true ")).toBe(true);
    expect(isSupabaseEnabled("1\r\n")).toBe(true);
    expect(isSupabaseEnabled("false\n")).toBe(false);
    expect(isSupabaseEnabled("  ")).toBe(false);
  });
});
