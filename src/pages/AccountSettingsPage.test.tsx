import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsPage } from "./AccountSettingsPage.js";

afterEach(cleanup);

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
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
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

  it("消費税端数の丸め方式を選択して保存できる", () => {
    render(<AccountSettingsPage />);

    const select = screen.getByLabelText("丸め方式") as HTMLSelectElement;
    expect(select.value).toBe("floor");
    fireEvent.change(select, { target: { value: "ceil" } });
    expect(select.value).toBe("ceil");
    expect(localStorage.getItem("genbahub:estimate-tax-rounding")).toBe("ceil");
  });

  it("チームメンバーをメールアドレスで招待できる（AC③・票construction_pm_mvp-1g7）", async () => {
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "owner@example.com" },
      session: { access_token: "token-abc" },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, emailId: "email-1", organizationName: "株式会社ラポルタ" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSettingsPage />);

    fireEvent.change(screen.getByLabelText("招待するメールアドレス"), {
      target: { value: "member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "招待する" }));

    await waitFor(() => {
      expect(screen.getByText("member@example.com に招待メールを送信しました")).toBeDefined();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/invite",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ email: "member@example.com", inviterName: "owner@example.com" }),
      }),
    );
  });

  it("未ログイン(access_tokenなし)で招待するとエラーを表示する", async () => {
    render(<AccountSettingsPage />); // beforeEachのuseAuthモックはsessionを持たない

    fireEvent.change(screen.getByLabelText("招待するメールアドレス"), {
      target: { value: "member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "招待する" }));

    await waitFor(() => {
      expect(screen.getByText("ログインが必要です")).toBeDefined();
    });
  });
});
