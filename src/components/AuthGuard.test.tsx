import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AuthGuard } from "./AuthGuard.js";

const { useAuth, navigate, hasSupabaseEnv } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  navigate: vi.fn(),
  hasSupabaseEnv: vi.fn(),
}));

vi.mock("../contexts/AuthContext.js", () => ({
  useAuth,
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate,
}));

vi.mock("../infra/supabase-client.js", () => ({
  hasSupabaseEnv,
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("allows access when Supabase auth is not configured", () => {
    hasSupabaseEnv.mockReturnValue(false);
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>local mode</div>
      </AuthGuard>,
    );

    expect(screen.getByText("local mode")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users when Supabase auth is enabled", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>protected</div>
      </AuthGuard>,
    );

    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("shows timeout warning after 30 minutes of inactivity", () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = { user: { id: "1", email: "test@example.com" }, access_token: "tok" };
    useAuth.mockReturnValue({ session, loading: false, signOut: vi.fn() });

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

  it("dismisses warning and resets timer when continue is clicked", () => {
    hasSupabaseEnv.mockReturnValue(true);
    const session = { user: { id: "1", email: "test@example.com" }, access_token: "tok" };
    useAuth.mockReturnValue({ session, loading: false, signOut: vi.fn() });

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
      fireEvent.click(screen.getByText("継続"));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows connection error after 8s loading timeout and offers login link", () => {
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({ session: null, loading: true, signOut: vi.fn() });

    render(
      <AuthGuard>
        <div>protected</div>
      </AuthGuard>,
    );

    expect(screen.getByText("読み込み中...")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(8 * 1000);
    });

    expect(screen.getByText("接続できません")).toBeDefined();
    const button = screen.getByText("ログインページへ");
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("calls signOut when logout is clicked in timeout warning", async () => {
    hasSupabaseEnv.mockReturnValue(true);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const session = { user: { id: "1", email: "test@example.com" }, access_token: "tok" };
    useAuth.mockReturnValue({ session, loading: false, signOut });

    render(
      <AuthGuard>
        <div>content</div>
      </AuthGuard>,
    );

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("ログアウト"));
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
