/**
 * Types — smoke tests for type constants.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_STAGE_PROBABILITY } from "../probability-model.js";
import type { DealStage, LossReason } from "../types.js";

describe("DealStage values", () => {
  const stages: DealStage[] = [
    "inquiry", "first_reply", "site_survey", "proposal",
    "contract", "kickoff", "won", "lost",
  ];

  it("all stages are defined", () => {
    expect(stages).toHaveLength(8);
  });

  it("each stage has a default probability", () => {
    for (const stage of stages) {
      expect(DEFAULT_STAGE_PROBABILITY[stage]).toBeDefined();
    }
  });

  it("won = 100, lost = 0", () => {
    expect(DEFAULT_STAGE_PROBABILITY.won).toBe(100);
    expect(DEFAULT_STAGE_PROBABILITY.lost).toBe(0);
  });
});

describe("LossReason values", () => {
  const reasons: LossReason[] = [
    "price", "schedule", "competitor", "unresponsive", "scope_mismatch", "other",
  ];

  it("all reasons are defined", () => {
    expect(reasons).toHaveLength(6);
    for (const r of reasons) {
      expect(typeof r).toBe("string");
    }
  });
});
