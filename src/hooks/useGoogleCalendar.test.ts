/**
 * useGoogleCalendar の主要パス検証。
 * React renderHook は重いので、フックが依存している純粋層
 * (readGoogleProviderToken / fetchPrimaryCalendarEvents) の挙動で代替する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_PROVIDER_TOKEN_STORAGE_KEY,
  readGoogleProviderToken,
} from "../contexts/AuthContext.js";
import {
  fetchPrimaryCalendarEvents,
  GoogleAuthExpiredError,
} from "../lib/google-calendar.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("useGoogleCalendar の依存層", () => {
  it("provider_token が sessionStorage に無いとき readGoogleProviderToken は null を返す（=connected:false 経路）", () => {
    expect(readGoogleProviderToken()).toBeNull();
  });

  it("provider_token があるとき readGoogleProviderToken はその値を返す", () => {
    window.sessionStorage.setItem(GOOGLE_PROVIDER_TOKEN_STORAGE_KEY, "fresh-token");
    expect(readGoogleProviderToken()).toBe("fresh-token");
  });

  it("401 のとき GoogleAuthExpiredError が発生し、フックは needsReconnect:true へ遷移できる", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({}),
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      fetchPrimaryCalendarEvents("stale", new Date("2025-07-01"), new Date("2025-07-31")),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);
  });
});
