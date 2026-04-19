/**
 * createCheckoutSession のユニットテスト。Stripe SDK はモックで注入する。
 */
import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  type StripeCheckoutSessionsAPI,
} from "../lib/checkout-session.js";

function makeMockCheckout(
  impl: StripeCheckoutSessionsAPI["create"],
): StripeCheckoutSessionsAPI {
  return { create: vi.fn(impl) };
}

describe("createCheckoutSession", () => {
  const baseInput = {
    plan: "standard" as const,
    priceId: "price_test_123",
    successUrl: "https://example.com/pricing/success",
    cancelUrl: "https://example.com/pricing/cancel",
  };

  it("Stripe から返った URL と session id をそのまま返す", async () => {
    const mock = makeMockCheckout(async () => ({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/c/pay/cs_test_abc",
    }));

    const result = await createCheckoutSession(mock, baseInput);

    expect(result.sessionId).toBe("cs_test_abc");
    expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_abc");
  });

  it("mode=subscription と line_items を Stripe に渡す", async () => {
    let lastParams: Record<string, unknown> | null = null;
    const mock: StripeCheckoutSessionsAPI = {
      create: async (params) => {
        lastParams = params;
        return {
          id: "cs_test_1",
          url: "https://checkout.stripe.com/c/pay/cs_test_1",
        };
      },
    };

    await createCheckoutSession(mock, baseInput);

    expect(lastParams).not.toBeNull();
    const params = lastParams!;
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toEqual([
      { price: "price_test_123", quantity: 1 },
    ]);
    expect(params.success_url).toBe(baseInput.successUrl);
    expect(params.cancel_url).toBe(baseInput.cancelUrl);
    expect(params.metadata).toEqual({ plan: "standard" });
  });

  it("customerEmail が渡されれば Stripe パラメータに含める", async () => {
    let lastParams: Record<string, unknown> | null = null;
    const mock: StripeCheckoutSessionsAPI = {
      create: async (params) => {
        lastParams = params;
        return {
          id: "cs_test_2",
          url: "https://checkout.stripe.com/c/pay/cs_test_2",
        };
      },
    };

    await createCheckoutSession(mock, {
      ...baseInput,
      customerEmail: "user@example.com",
    });

    expect(lastParams).not.toBeNull();
    expect(lastParams!.customer_email).toBe("user@example.com");
  });

  it("customerEmail を渡さなければ customer_email は含まれない", async () => {
    let lastParams: Record<string, unknown> | null = null;
    const mock: StripeCheckoutSessionsAPI = {
      create: async (params) => {
        lastParams = params;
        return {
          id: "cs_test_3",
          url: "https://checkout.stripe.com/c/pay/cs_test_3",
        };
      },
    };

    await createCheckoutSession(mock, baseInput);

    expect(lastParams).not.toBeNull();
    expect("customer_email" in lastParams!).toBe(false);
  });

  it("clientReferenceId を Stripe に渡す", async () => {
    let lastParams: Record<string, unknown> | null = null;
    const mock: StripeCheckoutSessionsAPI = {
      create: async (params) => {
        lastParams = params;
        return {
          id: "cs_test_4",
          url: "https://checkout.stripe.com/c/pay/cs_test_4",
        };
      },
    };

    await createCheckoutSession(mock, {
      ...baseInput,
      clientReferenceId: "user_uuid_abc",
    });

    expect(lastParams).not.toBeNull();
    expect(lastParams!.client_reference_id).toBe("user_uuid_abc");
  });

  it("priceId が空なら例外を投げる", async () => {
    const mock = makeMockCheckout(async () => ({
      id: "cs_x",
      url: "https://example.com",
    }));

    await expect(
      createCheckoutSession(mock, { ...baseInput, priceId: "" }),
    ).rejects.toThrow("priceId が指定されていません");
  });

  it("未対応のプランなら例外を投げる", async () => {
    const mock = makeMockCheckout(async () => ({
      id: "cs_x",
      url: "https://example.com",
    }));

    await expect(
      createCheckoutSession(mock, {
        ...baseInput,
        // @ts-expect-error: runtime validation path
        plan: "free",
      }),
    ).rejects.toThrow("未対応のプランです");
  });

  it("Stripe が URL を返さなければ例外を投げる", async () => {
    const mock = makeMockCheckout(async () => ({
      id: "cs_test_null",
      url: null,
    }));

    await expect(createCheckoutSession(mock, baseInput)).rejects.toThrow(
      "Stripe からセッション URL が返されませんでした",
    );
  });
});
