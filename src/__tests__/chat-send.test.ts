/* @vitest-environment node */

/**
 * api/chat/send.ts のユニットテスト
 * webhook パス / Bot REST API フォールバックパスをカバーする
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------- fetch モック ----------
type FetchCall = { url: string; init: RequestInit };
let fetchCalls: FetchCall[] = [];
let fetchResponse: { ok: boolean; status: number; body: unknown } = {
  ok: true,
  status: 200,
  body: { id: "111222333" },
};

vi.stubGlobal(
  "fetch",
  async (url: string, init: RequestInit): Promise<Response> => {
    fetchCalls.push({ url, init });
    const { ok, status, body } = fetchResponse;
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  },
);

// ---------- helper: VercelRequest / VercelResponse を手作り ----------
function makeReq(overrides: {
  method?: string;
  body?: unknown;
}): Parameters<typeof handler>[0] {
  return {
    method: overrides.method ?? "POST",
    headers: {},
    body: overrides.body,
  };
}

type ResState = {
  statusCode: number;
  body: unknown;
};

function makeRes(): [Parameters<typeof handler>[1], () => ResState] {
  const state: ResState = { statusCode: 200, body: undefined };
  const res = {
    setHeader: (_name: string, _value: string) => {},
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
    },
  } as Parameters<typeof handler>[1];
  return [res, () => state];
}

// 動的 import で env を差し込む
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: (...args: any[]) => Promise<void>;

// ---------- テスト ----------
describe("api/chat/send", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    fetchCalls = [];
    fetchResponse = { ok: true, status: 200, body: { id: "111222333" } };
    // 環境変数をリセット
    delete process.env.DISCORD_CHAT_WEBHOOK_URL;
    process.env.DISCORD_BOT_TOKEN = "test-bot-token";
    process.env.DISCORD_CHAT_CHANNEL_ID = "1498203083099082755";
  });

  afterEach(() => {
    // 元の env に戻す
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  async function importHandler() {
    const mod = await import("../../api/chat/send.js");
    return mod.default;
  }

  it("OPTIONS request returns 204", async () => {
    handler = await importHandler();
    const [res, getState] = makeRes();
    await handler(makeReq({ method: "OPTIONS" }), res);
    expect(getState().statusCode).toBe(204);
  });

  it("non-POST returns 405", async () => {
    handler = await importHandler();
    const [res, getState] = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(getState().statusCode).toBe(405);
  });

  it("missing body fields returns 400", async () => {
    handler = await importHandler();
    const [res, getState] = makeRes();
    await handler(makeReq({ body: { userId: "u1" } }), res);
    expect(getState().statusCode).toBe(400);
  });

  describe("Bot REST API fallback (no WEBHOOK_URL)", () => {
    it("posts via Bot REST API and returns messageId", async () => {
      handler = await importHandler();
      const [res, getState] = makeRes();
      await handler(makeReq({ body: { userId: "u1", text: "hello" } }), res);

      expect(getState().statusCode).toBe(200);
      expect(getState().body).toEqual({ ok: true, messageId: "111222333" });

      expect(fetchCalls).toHaveLength(1);
      const call = fetchCalls[0];
      expect(call.url).toContain("/channels/");
      expect(call.url).toContain("/messages");
      // Authorization ヘッダーに Bot トークンが含まれること
      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bot test-bot-token");

      const reqBody = JSON.parse(call.init.body as string);
      expect(reqBody.content).toBe("[GenbaHub:u1] hello");
    });

    it("returns 500 when neither token nor webhook is set", async () => {
      delete process.env.DISCORD_BOT_TOKEN;
      handler = await importHandler();
      const [res, getState] = makeRes();
      await handler(makeReq({ body: { userId: "u1", text: "hello" } }), res);
      expect(getState().statusCode).toBe(500);
    });

    it("returns 502 on Discord API error", async () => {
      fetchResponse = { ok: false, status: 403, body: { message: "Missing Permissions" } };
      handler = await importHandler();
      const [res, getState] = makeRes();
      await handler(makeReq({ body: { userId: "u1", text: "hello" } }), res);
      expect(getState().statusCode).toBe(502);
    });
  });

  describe("Webhook path (DISCORD_CHAT_WEBHOOK_URL set)", () => {
    beforeEach(() => {
      process.env.DISCORD_CHAT_WEBHOOK_URL =
        "https://discord.com/api/webhooks/123/abc-token";
    });

    it("posts via webhook URL with ?wait=true and username", async () => {
      handler = await importHandler();
      const [res, getState] = makeRes();
      await handler(makeReq({ body: { userId: "u2", text: "from panel" } }), res);

      expect(getState().statusCode).toBe(200);
      expect(getState().body).toEqual({ ok: true, messageId: "111222333" });

      expect(fetchCalls).toHaveLength(1);
      const call = fetchCalls[0];
      expect(call.url).toBe(
        "https://discord.com/api/webhooks/123/abc-token?wait=true",
      );
      // Authorization ヘッダーなし（webhook は不要）
      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();

      const reqBody = JSON.parse(call.init.body as string);
      expect(reqBody.content).toBe("[GenbaHub:u2] from panel");
      expect(reqBody.username).toBe("GenbaHub Panel");
    });

    it("returns 502 when webhook returns error", async () => {
      fetchResponse = { ok: false, status: 400, body: { message: "Bad Request" } };
      handler = await importHandler();
      const [res, getState] = makeRes();
      await handler(makeReq({ body: { userId: "u2", text: "from panel" } }), res);
      expect(getState().statusCode).toBe(502);
    });

    it("truncates text longer than 1800 chars", async () => {
      handler = await importHandler();
      const [res, getState] = makeRes();
      const longText = "x".repeat(2000);
      await handler(makeReq({ body: { userId: "u2", text: longText } }), res);
      expect(getState().statusCode).toBe(200);
      const call = fetchCalls[0];
      const reqBody = JSON.parse(call.init.body as string);
      // prefix "GenbaHub:u2] " + 1800 chars + "..."
      expect(reqBody.content.endsWith("...")).toBe(true);
      expect(reqBody.content.length).toBeLessThan(1900);
    });
  });
});
