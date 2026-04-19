import { describe, expect, it, vi } from "vitest";
import {
  handleInvoiceOcr,
  INVOICE_RATE_LIMIT_PER_MIN,
  MAX_BASE64_BYTES,
  type InvoiceOcrResponse,
} from "./invoice-ocr-handler.js";
import type { RateLimitStore } from "./rate-limiter.js";

function makeRes() {
  const calls: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const res: InvoiceOcrResponse = {
    status(code) {
      calls.status = code;
      return res;
    },
    json(body) {
      calls.body = body;
      return res;
    },
    setHeader(name, value) {
      calls.headers[name] = value;
    },
  };
  return { res, calls };
}

function okAuth() {
  return {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1", email: "a@b.c" } },
      error: null,
    })),
  };
}

function rlStore(count = 1): RateLimitStore {
  return {
    async increment() {
      return { count, error: null };
    },
  };
}

function anthropicOk(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({ content: [{ type: "text", text: `{"vendor": "X", "total": 1}` }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;
}

const validBody = {
  mediaType: "image/png",
  data: "aGVsbG8=",
  fileName: "a.png",
};

describe("handleInvoiceOcr — 認証", () => {
  it("Authorization ヘッダなしで 401", async () => {
    const { res, calls } = makeRes();
    await handleInvoiceOcr(
      { method: "POST", headers: {}, body: validBody },
      res,
      {
        auth: okAuth(),
        rateLimitStore: rlStore(),
        anthropicApiKey: "k",
        anthropicFetcher: anthropicOk(),
      },
    );
    expect(calls.status).toBe(401);
    expect((calls.body as { error: string }).error).toMatch(/認証/);
  });

  it("無効な JWT は 401", async () => {
    const { res, calls } = makeRes();
    await handleInvoiceOcr(
      {
        method: "POST",
        headers: { authorization: "Bearer bad" },
        body: validBody,
      },
      res,
      {
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "invalid" } }),
        },
        rateLimitStore: rlStore(),
        anthropicApiKey: "k",
        anthropicFetcher: anthropicOk(),
      },
    );
    expect(calls.status).toBe(401);
  });
});

describe("handleInvoiceOcr — サイズ上限", () => {
  it("5MB 超の base64 は 413", async () => {
    const { res, calls } = makeRes();
    const huge = "a".repeat(MAX_BASE64_BYTES + 1);
    await handleInvoiceOcr(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: { mediaType: "image/png", data: huge, fileName: "big.png" },
      },
      res,
      {
        auth: okAuth(),
        rateLimitStore: rlStore(),
        anthropicApiKey: "k",
        anthropicFetcher: anthropicOk(),
      },
    );
    expect(calls.status).toBe(413);
  });
});

describe("handleInvoiceOcr — レートリミット", () => {
  it("limit 超過で 429 + Retry-After", async () => {
    const { res, calls } = makeRes();
    await handleInvoiceOcr(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: validBody,
      },
      res,
      {
        auth: okAuth(),
        rateLimitStore: rlStore(INVOICE_RATE_LIMIT_PER_MIN + 1),
        anthropicApiKey: "k",
        anthropicFetcher: anthropicOk(),
      },
    );
    expect(calls.status).toBe(429);
    expect(calls.headers["Retry-After"]).toBeDefined();
  });
});

describe("handleInvoiceOcr — 正常系", () => {
  it("認証 + レート OK なら Anthropic に委譲して 200 を返す", async () => {
    const { res, calls } = makeRes();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ content: [{ type: "text", text: `{"vendor": "Y", "total": 2}` }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await handleInvoiceOcr(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: validBody,
      },
      res,
      {
        auth: okAuth(),
        rateLimitStore: rlStore(3),
        anthropicApiKey: "k",
        anthropicFetcher: fetcher as unknown as typeof fetch,
      },
    );
    expect(calls.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((calls.body as { text: string }).text).toMatch(/vendor/);
  });

  it("POST 以外は 405", async () => {
    const { res, calls } = makeRes();
    await handleInvoiceOcr(
      { method: "GET", headers: {}, body: {} },
      res,
      {
        auth: okAuth(),
        rateLimitStore: rlStore(),
      },
    );
    expect(calls.status).toBe(405);
  });
});
