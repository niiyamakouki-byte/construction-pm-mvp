/**
 * トライアル状態遷移のテスト（票 construction_pm_mvp-1g7）
 * 設計: docs/trial-to-paid-transition.md
 */
import { describe, expect, it } from "vitest";
import { resolveTrialState } from "./SubscriptionContext.js";

describe("resolveTrialState", () => {
  const now = new Date("2026-08-05T00:00:00Z");

  it("trial_ends_at が無ければ null（trial以外のplan）", () => {
    expect(resolveTrialState(null, now)).toBeNull();
    expect(resolveTrialState(undefined, now)).toBeNull();
  });

  it("残り14日はtrial_active（AC①: フル機能開放の判定対象）", () => {
    const trialEndsAt = new Date("2026-08-19T00:00:00Z").toISOString();
    const result = resolveTrialState(trialEndsAt, now);
    expect(result?.state).toBe("trial_active");
    expect(result?.daysRemaining).toBe(14);
  });

  it("残り3日はtrial_expiring_soon（AC②: 期限3日前警告）", () => {
    const trialEndsAt = new Date("2026-08-08T00:00:00Z").toISOString();
    const result = resolveTrialState(trialEndsAt, now);
    expect(result?.state).toBe("trial_expiring_soon");
    expect(result?.daysRemaining).toBe(3);
  });

  it("残り4日はまだtrial_active（境界値）", () => {
    const trialEndsAt = new Date("2026-08-09T00:00:00Z").toISOString();
    const result = resolveTrialState(trialEndsAt, now);
    expect(result?.state).toBe("trial_active");
  });

  it("期限切れはtrial_expired（AC②: free降格の判定対象）", () => {
    const trialEndsAt = new Date("2026-08-01T00:00:00Z").toISOString();
    const result = resolveTrialState(trialEndsAt, now);
    expect(result?.state).toBe("trial_expired");
    expect(result?.daysRemaining).toBe(0);
  });

  it("不正な日付文字列は null", () => {
    expect(resolveTrialState("not-a-date", now)).toBeNull();
  });
});
