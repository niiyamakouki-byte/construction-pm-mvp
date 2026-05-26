/**
 * ProtectedRoute (AuthGuard) — Phase 1.5
 * 未認証リダイレクト + 認証バイパス + organization scope 関連テスト
 */
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthGuard } from "../../components/AuthGuard.js";

// ── モック ───────────────────────────────────────────────────────

const { useAuth, navigate, hasSupabaseEnv } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  navigate: vi.fn(),
  hasSupabaseEnv: vi.fn(),
}));

vi.mock("../../contexts/AuthContext.js", () => ({ useAuth }));
vi.mock("../../hooks/useHashRouter.js", () => ({ navigate }));
vi.mock("../../infra/supabase-client.js", () => ({ hasSupabaseEnv }));
vi.mock("../../lib/audit-log.js", () => ({ appendAuditLog: vi.fn() }));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "user-123", email: "test@example.com", ...overrides },
    access_token: "token",
  };
}

// ── テスト ───────────────────────────────────────────────────────

describe("ProtectedRoute (AuthGuard) — organization scope", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // E2E bypass フラグを必ずリセット
    if (typeof window !== "undefined") {
      window.__E2E_BYPASS_AUTH__ = false;
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("Supabase 未設定時は認証なしでコンテンツを表示する（デモモード互換）", () => {
    hasSupabaseEnv.mockReturnValue(false);
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("protected content")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("未認証ユーザーは /login へリダイレクトされる", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>secret</div>
      </AuthGuard>,
    );

    expect(navigate).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("認証済みユーザーはコンテンツにアクセスできる", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({
      session: makeSession(),
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>dashboard</div>
      </AuthGuard>,
    );

    expect(screen.getByText("dashboard")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("loading=true の間はスピナーを表示しコンテンツをレンダリングしない", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({ session: null, loading: true, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("読み込み中...")).toBeDefined();
    expect(screen.queryByText("content")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("E2E bypass フラグが true の時は認証チェックをスキップする", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });
    if (typeof window !== "undefined") {
      window.__E2E_BYPASS_AUTH__ = true;
    }

    render(
      <AuthGuard>
        <div>e2e content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("e2e content")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("30分のタイムアウト後にセッション警告ダイアログを表示する", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({
      session: makeSession(),
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>content</div>
      </AuthGuard>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("セッションが切れそうです")).toBeDefined();
  });

  it("organization_id を持つユーザーの session がコンテンツを表示する", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({
      session: makeSession({ user_metadata: { organization_id: "org-abc" } }),
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>org content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("org content")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("セッション切れ警告で「継続」クリック後はダイアログが消える", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({
      session: makeSession(),
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>content</div>
      </AuthGuard>,
    );

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(screen.getByRole("dialog")).toBeDefined();

    act(() => {
      screen.getByText("継続").click();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("セッション切れ警告で「ログアウト」クリックすると signOut が呼ばれる", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({
      session: makeSession(),
      loading: false,
      signOut,
    });

    render(
      <AuthGuard>
        <div>content</div>
      </AuthGuard>,
    );

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    await act(async () => {
      screen.getByText("ログアウト").click();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
