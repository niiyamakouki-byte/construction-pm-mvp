/* @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { middleware } from "./middleware.js";

const originalApiKey = process.env.API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
    return;
  }

  process.env.API_KEY = originalApiKey;
});

describe("Next API middleware", () => {
  it("allows the health endpoint without an API key", () => {
    process.env.API_KEY = "test-api-key";

    const response = middleware(new Request("https://example.com/api/health"));

    expect(response).toBeUndefined();
  });

  it("rejects protected API routes without a valid API key", async () => {
    process.env.API_KEY = "test-api-key";

    const response = middleware(new Request("https://example.com/api/projects"));

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({
      error: "APIキーが未設定、または不正です。",
    });
  });

  it("allows protected API routes when the API key is valid", () => {
    process.env.API_KEY = "test-api-key";

    const response = middleware(
      new Request("https://example.com/api/projects", {
        headers: {
          "x-api-key": "test-api-key",
        },
      }),
    );

    expect(response).toBeUndefined();
  });
});
