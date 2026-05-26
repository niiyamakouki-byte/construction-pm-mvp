import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignupPage } from "./SignupPage.js";

const { navigate, getSupabaseClient, hasSupabaseEnv } = vi.hoisted(() => ({
  navigate: vi.fn(),
  getSupabaseClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate,
}));

vi.mock("../infra/supabase-client.js", () => ({
  getSupabaseClient,
  hasSupabaseEnv,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseEnv.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("rejects company names that are only whitespace", () => {
    const { container } = render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("会社名"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(container.querySelector("#password")!, {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "無料で始める" }).closest("form")!);

    expect(screen.getByRole("alert").textContent).toContain("会社名を入力してください");
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it("trims company and email values before signup", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    getSupabaseClient.mockResolvedValue({
      auth: {
        signUp,
      },
    });

    const { container } = render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("会社名"), {
      target: { value: "  株式会社ラポルタ  " },
    });
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: " user@example.com " },
    });
    fireEvent.change(container.querySelector("#password")!, {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード（確認）"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "無料で始める" }).closest("form")!);

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
        options: { data: { company_name: "株式会社ラポルタ" } },
      });
    });
  });
});
