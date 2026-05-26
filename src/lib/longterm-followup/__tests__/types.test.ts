/**
 * types.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  makeFollowupScheduleId,
  makeFollowupCheckpointId,
  makeDiagnosisFormId,
  makeRenovationLeadId,
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_STATUS_LABELS,
  DEGRADATION_CATEGORY_LABELS,
  LEAD_POTENTIAL_LABELS,
} from "../types.js";

describe("branded IDs", () => {
  it("makeFollowupScheduleId が文字列を返す", () => {
    const id = makeFollowupScheduleId("sched-001");
    expect(id).toBe("sched-001");
  });

  it("makeFollowupCheckpointId が文字列を返す", () => {
    const id = makeFollowupCheckpointId("chk-001");
    expect(id).toBe("chk-001");
  });

  it("makeDiagnosisFormId が文字列を返す", () => {
    const id = makeDiagnosisFormId("form-001");
    expect(id).toBe("form-001");
  });

  it("makeRenovationLeadId が文字列を返す", () => {
    const id = makeRenovationLeadId("lead-001");
    expect(id).toBe("lead-001");
  });
});

describe("CHECKPOINT_KIND_LABELS", () => {
  it("5種別すべてにラベルがある", () => {
    expect(CHECKPOINT_KIND_LABELS.three_month).toBe("3ヶ月点検");
    expect(CHECKPOINT_KIND_LABELS.one_year).toBe("1年点検");
    expect(CHECKPOINT_KIND_LABELS.three_year).toBe("3年点検");
    expect(CHECKPOINT_KIND_LABELS.five_year).toBe("5年点検");
    expect(CHECKPOINT_KIND_LABELS.ten_year).toBe("10年点検");
  });
});

describe("CHECKPOINT_STATUS_LABELS", () => {
  it("5ステータスすべてにラベルがある", () => {
    const statuses = ["scheduled", "reminder_sent", "diagnosis_sent", "completed", "skipped"] as const;
    for (const s of statuses) {
      expect(CHECKPOINT_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("DEGRADATION_CATEGORY_LABELS", () => {
  it("8カテゴリすべてにラベルがある", () => {
    const categories = [
      "exterior_wall",
      "roof",
      "waterproofing",
      "piping",
      "hvac",
      "fixtures",
      "interior_finish",
      "structural",
    ] as const;
    for (const cat of categories) {
      expect(DEGRADATION_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

describe("LEAD_POTENTIAL_LABELS", () => {
  it("4ポテンシャルすべてにラベルがある", () => {
    expect(LEAD_POTENTIAL_LABELS.low).toBe("低");
    expect(LEAD_POTENTIAL_LABELS.medium).toBe("中");
    expect(LEAD_POTENTIAL_LABELS.high).toBe("高");
    expect(LEAD_POTENTIAL_LABELS.urgent).toBe("緊急");
  });
});
