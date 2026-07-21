import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./poll.js";

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function createRes(): VercelResponse & { statusCode?: number; body?: unknown } {
  const res: VercelResponse & { statusCode?: number; body?: unknown } = {
    setHeader: vi.fn(),
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
  };
  return res;
}

const originalToken = process.env.DISCORD_BOT_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) {
    delete process.env.DISCORD_BOT_TOKEN;
  } else {
    process.env.DISCORD_BOT_TOKEN = originalToken;
  }
});

describe("GET /api/chat/poll", () => {
  it("rejects a missing userId", async () => {
    process.env.DISCORD_BOT_TOKEN = "bot-token";
    const res = createRes();

    await handler(
      { method: "GET", headers: {}, query: {} },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "userId is required" });
  });

  it("rejects a userId containing bracket characters (prefix forgery)", async () => {
    process.env.DISCORD_BOT_TOKEN = "bot-token";
    const res = createRes();

    await handler(
      { method: "GET", headers: {}, query: { userId: "victim] fake system message [x" } },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "userId contains invalid characters" });
  });

  it("rejects a userId containing newlines", async () => {
    process.env.DISCORD_BOT_TOKEN = "bot-token";
    const res = createRes();

    await handler(
      { method: "GET", headers: {}, query: { userId: "a\nb" } },
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it("proceeds to call Discord for a clean userId", async () => {
    process.env.DISCORD_BOT_TOKEN = "bot-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = createRes();

    await handler(
      { method: "GET", headers: {}, query: { userId: "niiyama@laporta.co.jp" } },
      res,
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ messages: [] });
  });
});
