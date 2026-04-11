import { describe, it, expect, beforeEach } from "vitest";
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  checkRateLimit,
  parsePagination,
  registerEndpoint,
  handleRequest,
  _clearApiKeys,
  _clearRateLimits,
  _clearEndpoints,
  type GatewayRequest,
} from "../lib/api-gateway.js";

// Reset in-memory state before each test
beforeEach(() => {
  _clearApiKeys();
  _clearRateLimits();
  _clearEndpoints();
});

// ── API key management ─────────────────────────────────────────────────────────

describe("generateApiKey", () => {
  it("一意のキーを生成する", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
  });

  it("genbahub_ プレフィックスを持つ", () => {
    const { key } = generateApiKey();
    expect(key.startsWith("genbahub_")).toBe(true);
  });

  it("revoked フラグは false で生成される", () => {
    const record = generateApiKey();
    expect(record.revoked).toBe(false);
  });

  it("createdAt が ISO 文字列", () => {
    const { createdAt } = generateApiKey();
    expect(() => new Date(createdAt)).not.toThrow();
    expect(new Date(createdAt).toISOString()).toBe(createdAt);
  });
});

describe("validateApiKey", () => {
  it("生成直後のキーは有効", () => {
    const { key } = generateApiKey();
    expect(validateApiKey(key)).toBe(true);
  });

  it("存在しないキーは無効", () => {
    expect(validateApiKey("genbahub_nonexistent")).toBe(false);
  });

  it("revoke 後のキーは無効", () => {
    const { key } = generateApiKey();
    revokeApiKey(key);
    expect(validateApiKey(key)).toBe(false);
  });
});

describe("revokeApiKey", () => {
  it("有効なキーを無効化して true を返す", () => {
    const { key } = generateApiKey();
    expect(revokeApiKey(key)).toBe(true);
  });

  it("存在しないキーは false を返す", () => {
    expect(revokeApiKey("genbahub_missing")).toBe(false);
  });
});

// ── Rate limiting ──────────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("60回目まで true を返す", () => {
    const key = "test-key";
    const endpoint = "/api/v1/projects";
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit(key, endpoint)).toBe(true);
    }
  });

  it("61回目で false を返す", () => {
    const key = "test-key";
    const endpoint = "/api/v1/projects";
    for (let i = 0; i < 60; i++) {
      checkRateLimit(key, endpoint);
    }
    expect(checkRateLimit(key, endpoint)).toBe(false);
  });

  it("異なるエンドポイントは独立したバケットを持つ", () => {
    const key = "test-key";
    for (let i = 0; i < 60; i++) {
      checkRateLimit(key, "/api/v1/projects");
    }
    // Different endpoint should still be allowed
    expect(checkRateLimit(key, "/api/v1/tasks")).toBe(true);
  });

  it("異なる API キーは独立したバケットを持つ", () => {
    const endpoint = "/api/v1/projects";
    for (let i = 0; i < 60; i++) {
      checkRateLimit("key-a", endpoint);
    }
    expect(checkRateLimit("key-b", endpoint)).toBe(true);
  });
});

// ── Pagination ─────────────────────────────────────────────────────────────────

describe("parsePagination", () => {
  it("デフォルト値: page=1, perPage=20", () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, perPage: 20, offset: 0 });
  });

  it("page と per_page を正しくパース", () => {
    const result = parsePagination({ page: "3", per_page: "10" });
    expect(result).toEqual({ page: 3, perPage: 10, offset: 20 });
  });

  it("per_page の上限は 100", () => {
    const result = parsePagination({ per_page: "200" });
    expect(result.perPage).toBe(100);
  });

  it("不正な値はデフォルトにフォールバック", () => {
    const result = parsePagination({ page: "abc", per_page: "-5" });
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it("offset = (page - 1) * perPage", () => {
    const result = parsePagination({ page: "4", per_page: "15" });
    expect(result.offset).toBe(45);
  });
});

// ── Endpoint registry & handleRequest ─────────────────────────────────────────

describe("handleRequest", () => {
  function makeRequest(override: Partial<GatewayRequest> = {}): GatewayRequest {
    return {
      method: "GET",
      pathname: "/api/v1/projects",
      query: {},
      apiKey: "valid-key",
      ...override,
    };
  }

  beforeEach(() => {
    // Register a valid key for handler tests
    const record = generateApiKey();
    // Override apiKey in tests with record.key
    Object.assign(makeRequest, { _validKey: record.key });
  });

  it("無効な API キーは error レスポンスを返す", async () => {
    const result = await handleRequest(makeRequest({ apiKey: "bad-key" }));
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("APIキー");
    }
  });

  it("API キー未設定は error レスポンスを返す", async () => {
    const result = await handleRequest(makeRequest({ apiKey: undefined }));
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.response.success).toBe(false);
    }
  });

  it("登録エンドポイントにマッチして success: true を返す", async () => {
    const { key } = generateApiKey();
    registerEndpoint("GET", /^\/api\/v1\/test$/, async () => ({
      success: true,
      data: { hello: "world" },
    }));
    const result = await handleRequest({ method: "GET", pathname: "/api/v1/test", query: {}, apiKey: key });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.response.success).toBe(true);
      expect((result.response.data as { hello: string }).hello).toBe("world");
    }
  });

  it("登録のないエンドポイントは matched: false を返す", async () => {
    const { key } = generateApiKey();
    const result = await handleRequest({ method: "GET", pathname: "/api/v1/unknown", query: {}, apiKey: key });
    expect(result.matched).toBe(false);
  });

  it("レートリミット超過後は error レスポンスを返す", async () => {
    const { key } = generateApiKey();
    registerEndpoint("GET", /^\/api\/v1\/ratelimit$/, async () => ({ success: true }));
    // Exhaust the rate limit
    for (let i = 0; i < 60; i++) {
      checkRateLimit(key, "/api/v1/ratelimit");
    }
    const result = await handleRequest({ method: "GET", pathname: "/api/v1/ratelimit", query: {}, apiKey: key });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("上限");
    }
  });
});

// ── ApiResponse shape ──────────────────────────────────────────────────────────

describe("ApiResponse shape", () => {
  it("meta フィールドに total/page/perPage が含まれる", async () => {
    // Re-register v1 endpoints after _clearEndpoints in beforeEach
    // by re-importing to trigger module-level side effects is not possible,
    // so we register a stub here that mirrors the v1 shape.
    const { key } = generateApiKey();
    registerEndpoint("GET", /^\/api\/v1\/projects$/, async (req) => {
      const { parsePagination: pp } = await import("../lib/api-gateway.js");
      const pagination = pp(req.query);
      return {
        success: true,
        data: [],
        meta: { total: 0, page: pagination.page, perPage: pagination.perPage },
      };
    });
    const result = await handleRequest({
      method: "GET",
      pathname: "/api/v1/projects",
      query: { page: "2", per_page: "10" },
      apiKey: key,
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.response.meta).toBeDefined();
      expect(result.response.meta?.page).toBe(2);
      expect(result.response.meta?.perPage).toBe(10);
      expect(result.response.meta?.total).toBe(0);
    }
  });
});
