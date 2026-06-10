import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPrimaryCalendarEvents,
  GoogleAuthExpiredError,
  GoogleCalendarError,
} from "./google-calendar.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const fakeResponse = {
    status: response.status ?? 200,
    ok: response.ok ?? (response.status ? response.status < 400 : true),
    json: async () => response.jsonBody ?? {},
  } as Response;
  globalThis.fetch = vi.fn().mockResolvedValueOnce(fakeResponse) as unknown as typeof fetch;
}

describe("fetchPrimaryCalendarEvents", () => {
  const timeMin = new Date("2025-07-01T00:00:00Z");
  const timeMax = new Date("2025-07-31T23:59:59Z");

  it("時刻指定イベントを正規化して返す", async () => {
    mockFetchOnce({
      status: 200,
      jsonBody: {
        items: [
          {
            id: "ev-1",
            summary: "打合せ",
            start: { dateTime: "2025-07-10T10:00:00+09:00" },
            end: { dateTime: "2025-07-10T11:00:00+09:00" },
          },
        ],
      },
    });

    const events = await fetchPrimaryCalendarEvents("token-xxx", timeMin, timeMax);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "ev-1",
      summary: "打合せ",
      allDay: false,
    });
    expect(events[0].start.toISOString()).toBe("2025-07-10T01:00:00.000Z");
  });

  it("終日イベント (date) を allDay=true で正規化する", async () => {
    mockFetchOnce({
      status: 200,
      jsonBody: {
        items: [
          {
            id: "ev-allday",
            summary: "夏休み",
            start: { date: "2025-07-20" },
            end: { date: "2025-07-22" },
          },
        ],
      },
    });

    const events = await fetchPrimaryCalendarEvents("token-xxx", timeMin, timeMax);

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].summary).toBe("夏休み");
  });

  it("401 のとき GoogleAuthExpiredError を投げる", async () => {
    mockFetchOnce({ status: 401, ok: false });
    await expect(
      fetchPrimaryCalendarEvents("expired", timeMin, timeMax),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);
  });

  it("401 以外のHTTPエラーで GoogleCalendarError を投げる", async () => {
    mockFetchOnce({ status: 500, ok: false });
    await expect(
      fetchPrimaryCalendarEvents("token", timeMin, timeMax),
    ).rejects.toBeInstanceOf(GoogleCalendarError);
  });

  it("Authorization ヘッダに Bearer トークンを付ける", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ items: [] }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchPrimaryCalendarEvents("my-token", timeMin, timeMax);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ Authorization: "Bearer my-token" });
  });
});
