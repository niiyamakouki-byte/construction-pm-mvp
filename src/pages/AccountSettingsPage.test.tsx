import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsPage } from "./AccountSettingsPage.js";

const { useAuth, getSupabaseClient, hasSupabaseEnv, readGoogleProviderToken } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getSupabaseClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  readGoogleProviderToken: vi.fn(() => null),
}));

vi.mock("../contexts/AuthContext.js", () => ({
  useAuth,
  readGoogleProviderToken,
}));

vi.mock("../infra/supabase-client.js", () => ({
  getSupabaseClient,
  hasSupabaseEnv,
}));

describe("AccountSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseEnv.mockReturnValue(true);
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "worker@example.com" },
    });
    window.sessionStorage.clear();
  });

  it("lets password recovery users set a new password without the current password", async () => {
    window.sessionStorage.setItem("genbahub_password_recovery", "1");

    const signInWithPassword = vi.fn();
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    getSupabaseClient.mockResolvedValue({
      auth: {
        signInWithPassword,
        updateUser,
      },
    });

    const { container } = render(<AccountSettingsPage />);

    expect(screen.queryByLabelText("現在のパスワード")).toBeNull();
    expect(screen.getByText("パスワード再設定モードです。新しいパスワードを設定してください。")).toBeDefined();

    fireEvent.change(container.querySelector("#new-password")!, {
      target: { value: "new-password-123" },
    });
    fireEvent.change(container.querySelector("#new-password-confirm")!, {
      target: { value: "new-password-123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "パスワードを変更" }).closest("form")!);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("genbahub_password_recovery")).toBeNull();
  });
});
