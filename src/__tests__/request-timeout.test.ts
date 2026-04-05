import { describe, expect, it, vi, afterEach } from "vitest";
import {
  TimeoutError,
  fetchWithTimeout,
  withTimeout,
} from "../infra/request-timeout.js";

describe("request-timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("withTimeout returns the original result before the deadline", async () => {
    await expect(
      withTimeout(Promise.resolve("ok"), { label: "fast task", timeoutMs: 50 }),
    ).resolves.toBe("ok");
  });

  it("withTimeout rejects with TimeoutError after the deadline", async () => {
    vi.useFakeTimers();

    const pending = withTimeout(new Promise<string>(() => {}), {
      label: "slow task",
      timeoutMs: 25,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("fetchWithTimeout aborts hanging fetch calls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
      ),
    );

    const pending = fetchWithTimeout("https://example.com", undefined, {
      label: "test fetch",
      timeoutMs: 25,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });
});
