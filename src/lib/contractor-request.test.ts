import { describe, expect, it, vi } from "vitest";
import {
  buildContractorRequestEmail,
  sendContractorRequest,
  DRY_RUN_RECIPIENT,
} from "./contractor-request.js";
import {
  handleShareTokenRequest,
  type ShareTokenResponse,
} from "./share-token-handler.js";
import type { SupabaseAuthVerifier } from "./auth-helper.js";

const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };
const testAuth: SupabaseAuthVerifier = {
  getUser: async (token: string) =>
    token === "valid-jwt"
      ? { data: { user: { id: "user-1" } }, error: null }
      : { data: { user: null }, error: { message: "invalid" } },
};

/** /api/share-token と Resend API の両方をルーティングするテスト用 fetch モック */
function makeRouterFetch(resendStatus = 200, resendBody: unknown = { id: "email_test123" }) {
  return vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("/api/share-token")) {
      const req = {
        method: "POST",
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        body: init.body,
      };
      let status = 200;
      let body: unknown = null;
      const res: ShareTokenResponse = {
        status(code) {
          status = code;
          return res;
        },
        json(b) {
          body = b;
          return res;
        },
        setHeader() {
          /* noop */
        },
      };
      await handleShareTokenRequest(req, res, { auth: testAuth, env: TEST_ENV });
      return new Response(JSON.stringify(body), { status });
    }
    // Resend API
    return new Response(JSON.stringify(resendBody), { status: resendStatus });
  }) as unknown as typeof fetch;
}

describe("buildContractorRequestEmail", () => {
  const base = {
    taskName: "軽鉄下地組み",
    projectName: "松下邸リノベーション",
    startDate: "2026-08-10",
    endDate: "2026-08-15",
    shareUrl: "https://example.com/#/portal/share/abc123",
  };

  it("件名にプロジェクト名と工程名を含む", () => {
    const { subject } = buildContractorRequestEmail(base);
    expect(subject).toContain("松下邸リノベーション");
    expect(subject).toContain("軽鉄下地組み");
  });

  it("本文に期間と閲覧リンクを含む", () => {
    const { text } = buildContractorRequestEmail(base);
    expect(text).toContain("2026-08-10");
    expect(text).toContain("2026-08-15");
    expect(text).toContain(base.shareUrl);
  });

  it("開始日・終了日が空なら「未定」と表示する", () => {
    const { text } = buildContractorRequestEmail({ ...base, startDate: "", endDate: "" });
    expect(text).toContain("未定 〜 未定");
  });
});

describe("sendContractorRequest", () => {
  const baseInput = {
    projectId: "proj-1",
    projectName: "松下邸リノベーション",
    taskName: "軽鉄下地組み",
    startDate: "2026-08-10",
    endDate: "2026-08-15",
  };
  const getAccessToken = async () => "valid-jwt";

  it("dry-runモードでは業者メール未設定でもDRY_RUN_RECIPIENT宛に送信する", async () => {
    const fetcher = makeRouterFetch();
    const result = await sendContractorRequest(
      { ...baseInput, mode: "dry-run" },
      { getAccessToken, fetcher, resendApiKey: "re_test" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipient).toBe(DRY_RUN_RECIPIENT);
      expect(result.emailId).toBe("email_test123");
      expect(result.shareUrl).toContain("/portal/share/");
    }
  });

  it("liveモードで業者メール未設定ならエラーを返し送信しない", async () => {
    const fetcher = makeRouterFetch();
    const result = await sendContractorRequest(
      { ...baseInput, mode: "live", contractorEmail: undefined },
      { getAccessToken, fetcher, resendApiKey: "re_test" },
    );
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("liveモードで業者メールが設定されていれば宛先に使う", async () => {
    const fetcher = makeRouterFetch();
    const result = await sendContractorRequest(
      { ...baseInput, mode: "live", contractorEmail: "contractor@example.com" },
      { getAccessToken, fetcher, resendApiKey: "re_test" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipient).toBe("contractor@example.com");
    }
  });

  it("Resend APIが失敗を返したらok:falseを返す", async () => {
    const fetcher = makeRouterFetch(422, { message: "invalid `to` field" });
    const result = await sendContractorRequest(
      { ...baseInput, mode: "dry-run" },
      { getAccessToken, fetcher, resendApiKey: "re_test" },
    );
    expect(result.ok).toBe(false);
  });
});
