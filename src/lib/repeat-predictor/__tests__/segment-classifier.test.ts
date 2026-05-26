/**
 * Tests for segment-classifier.
 */

import { describe, expect, it } from "vitest";
import { classifySegment } from "../segment-classifier.js";
import type { RepeatSignal } from "../types.js";
import type { RFMScores } from "../segment-classifier.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function sig(overrides: Partial<RepeatSignal> = {}): RepeatSignal {
  return {
    jobsCount: 3,
    lastJobMonthsAgo: 4,
    avgIntervalMonths: 6,
    totalRevenue: 10_000_000,
    avgMarginPct: 28,
    lastSatisfactionScore: 4,
    complaintCount: 0,
    referralCount: 0,
    ...overrides,
  };
}

function scores(overrides: Partial<RFMScores> = {}): RFMScores {
  return {
    recencyScore: 0.8,
    frequencyScore: 0.5,
    monetaryScore: 0.7,
    satisfactionScore: 0.8,
    referralScore: 0.0,
    ...overrides,
  };
}

// ── at_risk ────────────────────────────────────────────────────────────────

describe("segment: at_risk", () => {
  it("クレーム2件以上で at_risk", () => {
    expect(classifySegment(sig({ complaintCount: 2 }), scores())).toBe("at_risk");
    expect(classifySegment(sig({ complaintCount: 5 }), scores())).toBe("at_risk");
  });

  it("満足度<3 かつ クレーム1件以上で at_risk", () => {
    expect(
      classifySegment(
        sig({ lastSatisfactionScore: 2, complaintCount: 1 }),
        scores(),
      ),
    ).toBe("at_risk");
  });

  it("満足度3 かつ クレーム1件は at_risk にならない", () => {
    const result = classifySegment(
      sig({ lastSatisfactionScore: 3, complaintCount: 1 }),
      scores(),
    );
    expect(result).not.toBe("at_risk");
  });

  it("クレーム1件のみ (満足度null) は at_risk にならない", () => {
    const result = classifySegment(
      sig({ lastSatisfactionScore: null, complaintCount: 1 }),
      scores(),
    );
    expect(result).not.toBe("at_risk");
  });
});

// ── vip ────────────────────────────────────────────────────────────────────

describe("segment: vip", () => {
  it("高RFM + 紹介あり → vip", () => {
    expect(
      classifySegment(
        sig({ complaintCount: 0 }),
        scores({ frequencyScore: 0.85, monetaryScore: 0.9, referralScore: 0.7 }),
      ),
    ).toBe("vip");
  });

  it("monetaryScore < 0.7 では vip にならない", () => {
    const result = classifySegment(
      sig({ complaintCount: 0 }),
      scores({ frequencyScore: 0.85, monetaryScore: 0.6, referralScore: 0.7 }),
    );
    expect(result).not.toBe("vip");
  });

  it("frequencyScore < 0.7 では vip にならない", () => {
    const result = classifySegment(
      sig({ complaintCount: 0 }),
      scores({ frequencyScore: 0.5, monetaryScore: 0.9, referralScore: 0.7 }),
    );
    expect(result).not.toBe("vip");
  });

  it("referralScore < 0.4 では vip にならない", () => {
    const result = classifySegment(
      sig({ complaintCount: 0 }),
      scores({ frequencyScore: 0.85, monetaryScore: 0.9, referralScore: 0.3 }),
    );
    expect(result).not.toBe("vip");
  });
});

// ── dormant ────────────────────────────────────────────────────────────────

describe("segment: dormant", () => {
  it("最終発注12ヶ月以上前 → dormant", () => {
    expect(
      classifySegment(sig({ lastJobMonthsAgo: 12 }), scores({ recencyScore: 0.5 })),
    ).toBe("dormant");

    expect(
      classifySegment(sig({ lastJobMonthsAgo: 24 }), scores({ recencyScore: 0.2 })),
    ).toBe("dormant");
  });

  it("11.9ヶ月前は dormant にならない", () => {
    const result = classifySegment(
      sig({ lastJobMonthsAgo: 11.9 }),
      scores({ recencyScore: 0.5 }),
    );
    expect(result).not.toBe("dormant");
  });
});

// ── loyal ──────────────────────────────────────────────────────────────────

describe("segment: loyal", () => {
  it("頻度高く最近の発注あり → loyal", () => {
    expect(
      classifySegment(
        sig({ lastJobMonthsAgo: 4, complaintCount: 0 }),
        scores({ frequencyScore: 0.7, recencyScore: 0.8 }),
      ),
    ).toBe("loyal");
  });

  it("frequencyScore < 0.5 では loyal にならない", () => {
    const result = classifySegment(
      sig({ lastJobMonthsAgo: 4 }),
      scores({ frequencyScore: 0.3, recencyScore: 0.8 }),
    );
    expect(result).not.toBe("loyal");
  });
});

// ── promising ──────────────────────────────────────────────────────────────

describe("segment: promising", () => {
  it("1件のみの新規顧客 → promising", () => {
    expect(
      classifySegment(
        sig({ jobsCount: 1, lastJobMonthsAgo: 2 }),
        scores({ frequencyScore: 0.1, monetaryScore: 0.3, referralScore: 0.0 }),
      ),
    ).toBe("promising");
  });

  it("jobsCount=0、lastJobMonthsAgo=999 → dormant (案件なし=超長期休眠)", () => {
    // lastJobMonthsAgo=999 >= 12 なので dormant が正しい動作
    expect(
      classifySegment(
        sig({ jobsCount: 0, lastJobMonthsAgo: 999 }),
        scores({ frequencyScore: 0.0 }),
      ),
    ).toBe("dormant");
  });
});
