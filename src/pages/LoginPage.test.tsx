import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage.js";

const {
  navigate,
  getSupabaseClient,
  hasSupabaseEnv,
  getRememberLoginPreference,
  setRememberLoginPreference,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  getSupabaseClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  getRememberLoginPreference: vi.fn(),
  setRememberLoginPreference: vi.fn(),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate,
}));

vi.mock("../infra/supabase-client.js", () => ({
  getSupabaseClient,
  hasSupabaseEnv,
  getRememberLoginPreference,
  setRememberLoginPreference,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseEnv.mockReturnValue(true);
    getRememberLoginPreference.mockReturnValue(true);
    window.history.replaceState({}, "", "/#/login");
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the current app origin for Google OAuth redirects", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
    getSupabaseClient.mockResolvedValue({
      auth: {
        signInWithOAuth,
      },
    });

    render(<LoginPage />);

    fireEvent.click(screen.getByText("Google でログイン"));

    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/",
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
    });
  });

  it("sends password reset emails back to the account page", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    getSupabaseClient.mockResolvedValue({
      auth: {
        resetPasswordForEmail,
      },
    });

    render(<LoginPage />);

    fireEvent.click(screen.getByText("メールアドレスとパスワードでログイン"));
    fireEvent.change(screen.getAllByLabelText("メールアドレス")[0], {
      target: { value: " user@example.com " },
    });
    fireEvent.click(screen.getByText("パスワードを忘れた方"));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: "http://localhost:3000/#/account",
      });
    });
  });

  it("trims the email address before password login", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    getSupabaseClient.mockResolvedValue({
      auth: {
        signInWithPassword,
      },
    });

    render(<LoginPage />);

    fireEvent.click(screen.getByText("メールアドレスとパスワードでログイン"));
    fireEvent.change(screen.getAllByLabelText("メールアドレス")[0], {
      target: { value: " user@example.com " },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("shows a Japanese message when Google sign-in is rejected", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "access_denied" },
    });
    getSupabaseClient.mockResolvedValue({
      auth: { signInWithOAuth },
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("google-sign-in"));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("キャンセル");
    });
  });

  it("starts Apple sign-in with name and email scopes", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: null }, error: null });
    getSupabaseClient.mockResolvedValue({ auth: { signInWithOAuth } });
    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("apple-sign-in"));
    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {
          redirectTo: "http://localhost:3000/",
          scopes: "name email",
        },
      });
    });
  });

  it("sends a magic link with a PKCE redirect and then verifies the code", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    getSupabaseClient.mockResolvedValue({ auth: { signInWithOtp, verifyOtp } });
    render(<LoginPage />);
    fireEvent.click(screen.getByText("マジックリンクでログイン"));
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: " user@example.com " } });
    fireEvent.click(screen.getByText("認証メールを送信"));
    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        options: {
          emailRedirectTo: "http://localhost:3000/",
          shouldCreateUser: true,
        },
      });
    });
    fireEvent.change(screen.getByLabelText("確認コード"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("コードでログイン"));
    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        token: "123456",
        type: "email",
      });
    });
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("shows an OAuth error captured before the hash router runs", async () => {
    window.sessionStorage.setItem("genbahub_provider_redirect_error", "ログインをキャンセルしました。");
    getSupabaseClient.mockResolvedValue({ auth: {} });
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("キャンセル");
    });
  });
});
