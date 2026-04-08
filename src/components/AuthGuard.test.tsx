import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("allows access when Supabase auth is not configured", () => {
    hasSupabaseEnv.mockReturnValue(false);
    useAuth.mockReturnValue({ session: null, loading: false });

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
    useAuth.mockReturnValue({ session: null, loading: false });

    render(
      <AuthGuard>
        <div>protected</div>
      </AuthGuard>,
    );

    expect(navigate).toHaveBeenCalledWith("/login");
  });
});
