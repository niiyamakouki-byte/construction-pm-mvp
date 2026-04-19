import { describe, expect, it, vi } from "vitest";
import {
  computeWindowStart,
  consumeRateLimit,
  type RateLimitStore,
} from "./rate-limiter.js";

function makeStore(
  seq: Array<{ count: number; error?: { message: string } | null }>,
): RateLimitStore & { calls: number } {
  let i = 0;
  const store = {
    calls: 0,
    async increment() {
      store.calls++;
      const v = seq[Math.min(i, seq.length - 1)];
      i++;
      return { count: v.count, error: v.error ?? null };
    },
  };
  return store;
}

describe("computeWindowStart", () => {
  it("60秒の境界に切り下げる", () => {
    const t = new Date("2026-04-19T12:34:56.789Z");
    const start = computeWindowStart(t, 60);
    expect(start.toISOString()).toBe("2026-04-19T12:34:00.000Z");
  });
});

describe("consumeRateLimit", () => {
  it("limit 以下なら allowed=true を返す", async () => {
    const store = makeStore([{ count: 1 }]);
    const d = await consumeRateLimit(store, {
      userId: "u1",
      endpoint: "/api/x",
      limit: 10,
    });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.remaining).toBe(9);
  });

  it("count が limit を超えたら allowed=false + retryAfter", async () => {
    const store = makeStore([{ count: 11 }]);
    const now = new Date("2026-04-19T12:00:30.000Z");
    const d = await consumeRateLimit(store, {
      userId: "u1",
      endpoint: "/api/x",
      limit: 10,
      now: () => now,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      // 12:01:00 までの 30 秒
      expect(d.retryAfterSeconds).toBe(30);
    }
  });

  it("ストア障害は fail-open（allowed=true）", async () => {
    const store = makeStore([{ count: 0, error: { message: "db down" } }]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = await consumeRateLimit(store, {
      userId: "u1",
      endpoint: "/api/x",
      limit: 10,
    });
    expect(d.allowed).toBe(true);
    spy.mockRestore();
  });

  it("ちょうど limit のときは allowed=true (remaining=0)", async () => {
    const store = makeStore([{ count: 10 }]);
    const d = await consumeRateLimit(store, {
      userId: "u1",
      endpoint: "/api/x",
      limit: 10,
    });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.remaining).toBe(0);
  });
});
