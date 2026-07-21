/**
 * contact-webhook-receiver テスト
 */

import { describe, it, expect, vi } from "vitest";
import {
  receiveContactSubmission,
  receiveContactSubmissionAndNotify,
} from "./contact-webhook-receiver.js";
import type { ContactPayload } from "./contact-webhook-receiver.js";

function makePayload(overrides: Partial<ContactPayload> = {}): ContactPayload {
  return {
    name: "新山光輝",
    email: "test@laporta.co.jp",
    message: "LDK 20畳のリフォームを検討しています。",
    source: "laporta-hp",
    timestamp: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("receiveContactSubmission — バリデーション", () => {
  it("正常な payload なら ok:true を返す", () => {
    const result = receiveContactSubmission(makePayload());
    expect(result.ok).toBe(true);
  });

  it("name が空なら name エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ name: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("name が undefined なら name エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ name: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("name が 100文字超なら name エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ name: "あ".repeat(101) }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("email が空なら email エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ email: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    }
  });

  it("不正 email フォーマットなら email エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ email: "not-an-email" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    }
  });

  it("message が空なら message エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ message: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "message")).toBe(true);
    }
  });

  it("message が 5000文字超なら message エラーを返す", () => {
    const result = receiveContactSubmission(makePayload({ message: "あ".repeat(5001) }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "message")).toBe(true);
    }
  });

  it("複数フィールドが無効なら複数エラーを返す", () => {
    const result = receiveContactSubmission({ name: "", email: "bad", message: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("receiveContactSubmission — サニタイズ", () => {
  it("HTMLタグを除去する", () => {
    const result = receiveContactSubmission(
      makePayload({ name: "<b>新山</b>", message: "工事<b>依頼</b>です" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.name).toBe("新山");
      expect(result.submission.message).toBe("工事依頼です");
    }
  });

  it("前後空白をトリムする", () => {
    const result = receiveContactSubmission(makePayload({ name: "  新山  ", email: "  test@laporta.co.jp  " }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.name).toBe("新山");
      expect(result.submission.email).toBe("test@laporta.co.jp");
    }
  });

  it("source が空の場合は laporta-hp をデフォルトにする", () => {
    const result = receiveContactSubmission(makePayload({ source: "" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.source).toBe("laporta-hp");
    }
  });

  it("無効な timestamp の場合は現在時刻を使う", () => {
    const before = Date.now();
    const result = receiveContactSubmission(makePayload({ timestamp: "not-a-date" }));
    const after = Date.now();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ts = Date.parse(result.submission.timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });

  it("phone が省略されている場合は submission に含まれない", () => {
    const result = receiveContactSubmission(makePayload({ phone: undefined }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.phone).toBeUndefined();
    }
  });

  it("phone が指定されている場合は submission に含まれる", () => {
    const result = receiveContactSubmission(makePayload({ phone: "03-1234-5678" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.phone).toBe("03-1234-5678");
    }
  });

  it("submission の id は一意の文字列", () => {
    const a = receiveContactSubmission(makePayload());
    const b = receiveContactSubmission(makePayload());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.submission.id).not.toBe(b.submission.id);
    }
  });
});

describe("receiveContactSubmissionAndNotify — 運営通知", () => {
  it("正常な問い合わせを運営宛に送信する", async () => {
    const sendEmailImpl = vi.fn().mockResolvedValue({ id: "email-contact-1" });

    const result = await receiveContactSubmissionAndNotify(
      makePayload({ phone: "03-1234-5678", address: "東京都港区" }),
      { sendEmailImpl },
    );

    expect(result.ok).toBe(true);
    expect(sendEmailImpl).toHaveBeenCalledWith({
      to: "niiyama@laporta.co.jp",
      subject: "[LapoSite] 新しい問い合わせ: 新山光輝",
      text: expect.stringContaining("LDK 20畳のリフォームを検討しています。"),
      replyTo: "test@laporta.co.jp",
    });
    expect(result).toMatchObject({
      ok: true,
      notification: { email: { id: "email-contact-1" } },
    });
  });

  it("無効な問い合わせではメールを送信しない", async () => {
    const sendEmailImpl = vi.fn().mockResolvedValue({ id: "unused" });

    const result = await receiveContactSubmissionAndNotify(
      makePayload({ email: "invalid" }),
      { sendEmailImpl },
    );

    expect(result.ok).toBe(false);
    expect(sendEmailImpl).not.toHaveBeenCalled();
  });
});
