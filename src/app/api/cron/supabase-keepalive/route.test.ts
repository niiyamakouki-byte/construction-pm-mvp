/* @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route.js";

const originalUseSupabase = process.env.USE_SUPABASE;
const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalUseSupabase === undefined) {
    delete process.env.USE_SUPABASE;
  } else {
    process.env.USE_SUPABASE = originalUseSupabase;
  }

  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("Supabase keepalive cron route", () => {
  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/cron/supabase-keepalive"));
    const body = (await response.json()) as { status: string; error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "misconfigured",
      error: "CRON_SECRET is required",
    });
  });

  it("returns 401 when authorization does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await GET(new Request("http://localhost/api/cron/supabase-keepalive"));
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ status: "unauthorized" });
  });

  it("returns 200 and queries health when authorization matches", async () => {
    delete process.env.USE_SUPABASE;
    process.env.CRON_SECRET = "test-secret";

    const response = await GET(
      new Request("http://localhost/api/cron/supabase-keepalive", {
        headers: {
          authorization: "Bearer test-secret",
        },
      }),
    );
    const body = (await response.json()) as {
      status: string;
      uptime: number;
      database: { provider: string; connected: boolean };
      triggeredBy: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeTypeOf("number");
    expect(body.database).toEqual({
      provider: "json-file",
      connected: true,
    });
    expect(body.triggeredBy).toBe("vercel-cron");
  });
});
