import { describe, expect, it } from "vitest";
import { computeAuthGuardWouldRenderChildren, computeShouldBootstrapFirstRun } from "./first-run-bootstrap-gate.js";

describe("computeAuthGuardWouldRenderChildren", () => {
  it("未認証(session無し)・本番Supabase環境ではfalse(=bootstrap非発火)", () => {
    expect(
      computeAuthGuardWouldRenderChildren({
        isE2EBypass: false,
        hasSupabaseEnv: true,
        authLoading: false,
        hasUser: false,
      }),
    ).toBe(false);
  });

  it("authLoading中(セッション確認前)もfalse", () => {
    expect(
      computeAuthGuardWouldRenderChildren({
        isE2EBypass: false,
        hasSupabaseEnv: true,
        authLoading: true,
        hasUser: false,
      }),
    ).toBe(false);
  });

  it("認証済みユーザーはtrue", () => {
    expect(
      computeAuthGuardWouldRenderChildren({
        isE2EBypass: false,
        hasSupabaseEnv: true,
        authLoading: false,
        hasUser: true,
      }),
    ).toBe(true);
  });

  it("E2Eバイパス・Supabase未設定は従来通りtrue", () => {
    expect(
      computeAuthGuardWouldRenderChildren({ isE2EBypass: true, hasSupabaseEnv: true, authLoading: false, hasUser: false }),
    ).toBe(true);
    expect(
      computeAuthGuardWouldRenderChildren({ isE2EBypass: false, hasSupabaseEnv: false, authLoading: false, hasUser: false }),
    ).toBe(true);
  });
});

describe("computeShouldBootstrapFirstRun", () => {
  it("未認証ゲートがfalseならbootstrapも発火しない(laporta-beads-pfn0s再現ガード)", () => {
    expect(
      computeShouldBootstrapFirstRun({
        authGuardWouldRenderChildren: false,
        onboardingDone: false,
        route: "/app",
        lastProjectId: null,
      }),
    ).toBe(false);
  });

  it("認証済み・初回・/appならbootstrap発火", () => {
    expect(
      computeShouldBootstrapFirstRun({
        authGuardWouldRenderChildren: true,
        onboardingDone: false,
        route: "/app",
        lastProjectId: null,
      }),
    ).toBe(true);
  });
});
