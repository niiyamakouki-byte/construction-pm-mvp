import { describe, expect, it, vi } from "vitest";
import { ResendApiError, ResendConfigError, sendEmail } from "./resend-client.js";

function makeMockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("sendEmail", () => {
  const baseInput = {
    to: "niiyama@laporta.co.jp",
    subject: "テスト送信",
    text: "本文",
  };

  it("APIキー未設定ならResendConfigErrorを投げる", async () => {
    await expect(sendEmail(baseInput, { apiKey: undefined, fetchImpl: makeMockFetch(200, {}) })).rejects.toThrow(
      ResendConfigError,
    );
  });

  it("html/textどちらも未指定ならResendConfigErrorを投げる", async () => {
    await expect(
      sendEmail({ to: "a@example.com", subject: "x" }, { apiKey: "re_test", fetchImpl: makeMockFetch(200, {}) }),
    ).rejects.toThrow(ResendConfigError);
  });

  it("成功時はResendが返したidを返す", async () => {
    const fetchImpl = makeMockFetch(200, { id: "email_abc123" });
    const result = await sendEmail(baseInput, { apiKey: "re_test", fetchImpl });
    expect(result.id).toBe("email_abc123");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
      }),
    );
  });

  it("Resend APIがエラーを返したらResendApiErrorを投げる", async () => {
    const fetchImpl = makeMockFetch(422, { message: "invalid `to` field" });
    await expect(sendEmail(baseInput, { apiKey: "re_test", fetchImpl })).rejects.toThrow(ResendApiError);
  });

  it("from未指定時はデフォルトの共有ドメイン(resend.dev)を使う", async () => {
    let sentBody: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return { ok: true, status: 200, json: async () => ({ id: "x" }) };
    }) as unknown as typeof fetch;

    await sendEmail(baseInput, { apiKey: "re_test", fetchImpl });
    expect(sentBody.from).toBe("GenbaHub <onboarding@resend.dev>");
  });
});
