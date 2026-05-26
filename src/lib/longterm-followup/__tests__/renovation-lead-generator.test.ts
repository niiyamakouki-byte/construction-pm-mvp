/**
 * renovation-lead-generator.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateLead,
  determinePotential,
  _resetLeadCounter,
} from "../renovation-lead-generator.js";
import {
  makeFollowupScheduleId,
  makeFollowupCheckpointId,
} from "../types.js";
import type { DegradationAnalysis } from "../degradation-analyzer.js";

const SCHEDULE_ID = makeFollowupScheduleId("sched-001");
const CHECKPOINT_ID = makeFollowupCheckpointId("chk-001");
const PROJECT_ID = "proj-001";
const OWNER_ID = "owner-001";
const NOW = new Date("2026-05-09T10:00:00.000Z");

function makeAnalysis(overallScore: number, urgentCategories: string[] = []): DegradationAnalysis {
  return {
    categoryScores: {
      exterior_wall: 0,
      roof: 0,
      waterproofing: 0,
      piping: 0,
      hvac: 0,
      fixtures: 0,
      interior_finish: 0,
      structural: 0,
    },
    overallScore,
    urgentCategories: urgentCategories as DegradationAnalysis["urgentCategories"],
  };
}

beforeEach(() => {
  _resetLeadCounter();
});

describe("determinePotential", () => {
  it("overallScore >= 60 → urgent (劣化が著しい)", () => {
    expect(determinePotential(60)).toBe("urgent");
    expect(determinePotential(100)).toBe("urgent");
  });

  it("overallScore 40-59 → high", () => {
    expect(determinePotential(40)).toBe("high");
    expect(determinePotential(59)).toBe("high");
  });

  it("overallScore 20-39 → medium", () => {
    expect(determinePotential(20)).toBe("medium");
    expect(determinePotential(39)).toBe("medium");
  });

  it("overallScore < 20 → low (良好)", () => {
    expect(determinePotential(0)).toBe("low");
    expect(determinePotential(19)).toBe("low");
  });
});

describe("generateLead", () => {
  it("urgent リードが生成される (overallScore=80)", () => {
    const analysis = makeAnalysis(80, ["exterior_wall", "roof"]);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "five_year", analysis, NOW,
    );
    expect(lead.potential).toBe("urgent");
    expect(lead.overallScore).toBe(80);
  });

  it("high リードが生成される (overallScore=50)", () => {
    const analysis = makeAnalysis(50, ["waterproofing"]);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "five_year", analysis, NOW,
    );
    expect(lead.potential).toBe("high");
  });

  it("medium リードが生成される (overallScore=30)", () => {
    const analysis = makeAnalysis(30);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "one_year", analysis, NOW,
    );
    expect(lead.potential).toBe("medium");
  });

  it("low リードが生成される (overallScore=10)", () => {
    const analysis = makeAnalysis(10);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "three_month", analysis, NOW,
    );
    expect(lead.potential).toBe("low");
  });

  it("推奨工種が少なくとも1件設定される", () => {
    const analysis = makeAnalysis(30, ["exterior_wall"]);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "five_year", analysis, NOW,
    );
    expect(lead.recommendedWorkTypes.length).toBeGreaterThan(0);
  });

  it("10年点検では大規模リフォーム工種が含まれる", () => {
    const analysis = makeAnalysis(85, []);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "ten_year", analysis, NOW,
    );
    // 10年点検では kind ベースで工種が追加される
    expect(lead.recommendedWorkTypes.length).toBeGreaterThan(0);
  });

  it("概算金額レンジが設定される", () => {
    const analysis = makeAnalysis(30, ["exterior_wall"]);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "five_year", analysis, NOW,
    );
    expect(lead.estimatedMinJpy).toBeGreaterThan(0);
    expect(lead.estimatedMaxJpy).toBeGreaterThanOrEqual(lead.estimatedMinJpy);
  });

  it("提案タイミングが設定される", () => {
    const analysis = makeAnalysis(30);
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "five_year", analysis, NOW,
    );
    expect(lead.proposalTimingJa).toBeTruthy();
  });

  it("urgentの提案タイミングは「早急に」を含む", () => {
    const analysis = makeAnalysis(75); // >= 60 → urgent
    const lead = generateLead(
      SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID,
      "ten_year", analysis, NOW,
    );
    expect(lead.proposalTimingJa).toContain("早急");
  });

  it("リードIDがユニーク", () => {
    const analysis = makeAnalysis(50);
    const lead1 = generateLead(SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID, "one_year", analysis, NOW);
    const lead2 = generateLead(SCHEDULE_ID, CHECKPOINT_ID, PROJECT_ID, OWNER_ID, "five_year", analysis, NOW);
    expect(lead1.id).not.toBe(lead2.id);
  });
});
