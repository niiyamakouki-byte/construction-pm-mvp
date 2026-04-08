/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

describe("createServerSupabaseClient", () => {
  afterEach(() => {
    createClient.mockReset();
  });

  it("uses server-safe auth settings with the service role key", async () => {
    createClient.mockReturnValue({});

    const { createServerSupabaseClient } = await import("./supabase-tools.js");
    createServerSupabaseClient("https://example.supabase.co", "service-role-key");

    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-role-key", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  });
});
