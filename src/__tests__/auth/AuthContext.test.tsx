/**
 * AuthContext — Phase 1.5
 * login / logout / session restore / organization_id 提供 のユニットテスト
 */
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth, AuthProvider } from "../../contexts/AuthContext.js";

// ── モック設定 ────────────────────────────────────────────────────

const { getSupabaseClient, hasSupabaseEnv } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
}));

const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("../../infra/supabase-client.js", () => ({
  getSupabaseClient,
  hasSupabaseEnv,
}));

vi.mock("../../hooks/useHashRouter.js", () => ({
  navigate,
}));

vi.mock("../../lib/audit-log.js", () => ({
  appendAuditLog: vi.fn(),
}));

vi.mock("../../lib/password-recovery.js", () => ({
  clearPasswordRecoveryMode: vi.fn(),
  markPasswordRecoveryMode: vi.fn(),
}));

// ── ヘルパー ─────────────────────────────────────────────────────

type AuthStateCallback = (event: string, session: unknown) => void;

function makeSupabaseClient(
  initialSession: unknown = null,
  options: { onAuthChange?: (cb: AuthStateCallback) => void } = {},
) {
  const subscription = { unsubscribe: vi.fn() };
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: initialSession } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn((cb: AuthStateCallback) => {
        options.onAuthChange?.(cb);
        return { data: { subscription } };
      }),
    },
    subscription,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "user-123",
      email: "test@example.com",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
    access_token: "access-token-xyz",
  };
}

function AuthConsumer() {
  const { session, user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "ready"}</span>
      <span data-testid="session">{session ? "authenticated" : "unauthenticated"}</span>
      <span data-testid="user-email">{user?.email ?? "none"}</span>
    </div>
  );
}

// ── テスト ───────────────────────────────────────────────────────

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("Supabase 未設定時は loading=false・session=null で即時解決する", async () => {
    hasSupabaseEnv.mockReturnValue(false);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    expect(screen.getByTestId("session").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("user-email").textContent).toBe("none");
  });

  it("既存セッションがあれば session restore する", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = makeSession();
    const client = makeSupabaseClient(session);
    getSupabaseClient.mockResolvedValue(client);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    expect(screen.getByTestId("session").textContent).toBe("authenticated");
    expect(screen.getByTestId("user-email").textContent).toBe("test@example.com");
  });

  it("セッションなしの場合は unauthenticated になる", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const client = makeSupabaseClient(null);
    getSupabaseClient.mockResolvedValue(client);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    expect(screen.getByTestId("session").textContent).toBe("unauthenticated");
  });

  it("SIGNED_IN イベントで session がセットされ /app へ遷移する", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = makeSession();
    let savedCallback: AuthStateCallback | null = null;
    const client = makeSupabaseClient(null, {
      onAuthChange: (cb) => { savedCallback = cb; },
    });
    getSupabaseClient.mockResolvedValue(client);

    // 初回 getSession を null に、auth state change で SIGNED_IN を送る
    client.auth.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    await act(async () => {
      savedCallback?.("SIGNED_IN", session);
    });

    expect(screen.getByTestId("session").textContent).toBe("authenticated");
    expect(navigate).toHaveBeenCalledWith("/app");
  });

  it("SIGNED_OUT イベントで session が null になる", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = makeSession();
    let savedCallback: AuthStateCallback | null = null;
    const client = makeSupabaseClient(session, {
      onAuthChange: (cb) => { savedCallback = cb; },
    });
    getSupabaseClient.mockResolvedValue(client);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("session").textContent).toBe("authenticated");
    });

    await act(async () => {
      savedCallback?.("SIGNED_OUT", null);
    });

    expect(screen.getByTestId("session").textContent).toBe("unauthenticated");
  });

  it("signOut を呼ぶと supabase.auth.signOut が実行され session が null になる", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = makeSession();
    const client = makeSupabaseClient(session);
    getSupabaseClient.mockResolvedValue(client);

    function SignOutButton() {
      const { signOut, session: s } = useAuth();
      return (
        <button onClick={() => void signOut()}>
          {s ? "signed-in" : "signed-out"}
        </button>
      );
    }

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button").textContent).toBe("signed-in");
    });

    await act(async () => {
      screen.getByRole("button").click();
    });

    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("Supabase 未設定時は signOut が何もしない", async () => {
    hasSupabaseEnv.mockReturnValue(false);

    function SignOutButton() {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut()}>signout</button>;
    }

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole("button").click();
    });

    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it("メール未確認 (email_confirmed_at=null) のユーザーは /app へ遷移しない", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    let savedCallback: AuthStateCallback | null = null;
    const client = makeSupabaseClient(null, {
      onAuthChange: (cb) => { savedCallback = cb; },
    });
    getSupabaseClient.mockResolvedValue(client);
    client.auth.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    const unconfirmedSession = makeSession({ email_confirmed_at: null });
    await act(async () => {
      savedCallback?.("SIGNED_IN", unconfirmedSession);
    });

    // セッションはセットされるが navigate は呼ばれない
    expect(screen.getByTestId("session").textContent).toBe("authenticated");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("getSupabaseClient が失敗しても loading=false になりクラッシュしない", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    getSupabaseClient.mockRejectedValue(new Error("connection failed"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    expect(screen.getByTestId("session").textContent).toBe("unauthenticated");
  });
});
