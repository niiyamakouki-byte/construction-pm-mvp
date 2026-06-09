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
        options: { redirectTo: "http://localhost:3000/" },
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
});
