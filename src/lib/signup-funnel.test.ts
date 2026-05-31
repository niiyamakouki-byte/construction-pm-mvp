import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FUNNEL_STEPS,
  aggregateFunnel,
  getFunnelEvents,
  trackFunnelStep,
  type FunnelEvent,
} from "./signup-funnel.js";

vi.mock("./analytics.js", () => ({ trackEvent: vi.fn() }));

const FUNNEL_KEY = "genbahub_signup_funnel";

// localStorage mock（OnboardingChecklist.test と同方式）
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, "window", { value: globalThis, writable: true });

describe("trackFunnelStep / getFunnelEvents", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ステップを localStorage に追記する", () => {
    trackFunnelStep("signup_started");
    trackFunnelStep("signup_completed");
    const events = getFunnelEvents();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.step)).toEqual(["signup_started", "signup_completed"]);
    expect(typeof events[0].at).toBe("number");
  });

  it("既存 trackEvent にも転送する", async () => {
    const { trackEvent } = await import("./analytics.js");
    trackFunnelStep("onboarding_started");
    expect(trackEvent).toHaveBeenCalledWith("onboarding_started", { source: "signup_funnel" });
  });

  it("不正な localStorage 値は空配列にフォールバックする", () => {
    localStorage.setItem(FUNNEL_KEY, "not-json");
    expect(getFunnelEvents()).toEqual([]);
  });

  it("未知のステップ・不正な形のイベントを除外する", () => {
    localStorage.setItem(
      FUNNEL_KEY,
      JSON.stringify([
        { step: "signup_started", at: 1 },
        { step: "bogus_step", at: 2 },
        { step: "signup_completed", at: "x" },
        { nope: true },
      ]),
    );
    const events = getFunnelEvents();
    expect(events).toEqual([{ step: "signup_started", at: 1 }]);
  });
});

describe("aggregateFunnel", () => {
  const make = (step: (typeof FUNNEL_STEPS)[number]): FunnelEvent => ({ step, at: Date.now() });

  it("イベントなしで全ステップ 0 件を返す", () => {
    const stats = aggregateFunnel([]);
    expect(stats).toHaveLength(FUNNEL_STEPS.length);
    expect(stats.every((s) => s.count === 0)).toBe(true);
    expect(stats[0].conversionFromPrev).toBe(100);
    expect(stats[0].dropOff).toBe(0);
  });

  it("到達数・遷移率・離脱率を集計する", () => {
    const events: FunnelEvent[] = [
      // signup_started ×10
      ...Array.from({ length: 10 }, () => make("signup_started")),
      // signup_completed ×6
      ...Array.from({ length: 6 }, () => make("signup_completed")),
      // onboarding_started ×3
      ...Array.from({ length: 3 }, () => make("onboarding_started")),
      // sample_project_seeded ×3
      ...Array.from({ length: 3 }, () => make("sample_project_seeded")),
      // first_real_action ×1
      make("first_real_action"),
    ];
    const stats = aggregateFunnel(events);

    expect(stats[0]).toMatchObject({ step: "signup_started", count: 10, conversionFromTop: 100, dropOff: 0 });
    // 6/10 = 60% 到達 → 40% 離脱
    expect(stats[1]).toMatchObject({ step: "signup_completed", count: 6 });
    expect(stats[1].conversionFromPrev).toBeCloseTo(60);
    expect(stats[1].dropOff).toBeCloseTo(40);
    expect(stats[1].conversionFromTop).toBeCloseTo(60);
    // 3/6 = 50%
    expect(stats[2].dropOff).toBeCloseTo(50);
    // 3/3 = 0% 離脱
    expect(stats[3].dropOff).toBeCloseTo(0);
    // 1/3 ≈ 67% 離脱
    expect(stats[4].count).toBe(1);
    expect(stats[4].dropOff).toBeCloseTo(66.6667, 3);
    expect(stats[4].conversionFromTop).toBeCloseTo(10);
  });

  it("先頭が 0 件のとき除算でクラッシュしない", () => {
    const stats = aggregateFunnel([make("signup_completed")]);
    expect(stats[0].count).toBe(0);
    expect(stats[1].count).toBe(1);
    // 先頭 0 のため先頭比は 0、直前比も 0
    expect(stats[1].conversionFromTop).toBe(0);
    expect(stats[1].conversionFromPrev).toBe(0);
  });
});
