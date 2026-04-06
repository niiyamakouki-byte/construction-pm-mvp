/* @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route.js";

const originalUseSupabase = process.env.USE_SUPABASE;

afterEach(() => {
  if (originalUseSupabase === undefined) {
    delete process.env.USE_SUPABASE;
    return;
  }

  process.env.USE_SUPABASE = originalUseSupabase;
});

describe("Next health route", () => {
  it("returns server status, uptime, and database connectivity", async () => {
    delete process.env.USE_SUPABASE;

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      uptime: number;
      database: { provider: string; connected: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeTypeOf("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.database).toEqual({
      provider: "json-file",
      connected: true,
    });
  });
});
