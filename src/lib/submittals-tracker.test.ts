import { beforeEach, describe, expect, it } from "vitest";
import {
  approveSubmittal,
  clearSubmittals,
  createSubmittal,
  generateSubmittalsLog,
  getSubmittals,
  rejectSubmittal,
  reviewSubmittal,
} from "./submittals-tracker.js";

describe("submittals-tracker", () => {
  beforeEach(() => {
    clearSubmittals();
  });

  it("creates material submittals with generated ids and initial history", () => {
    const submittal = createSubmittal({
      projectId: "proj-1",
      specSection: "07 27 00",
      materialName: "Air barrier membrane",
      submittedBy: "Procurement Lead",
      supplier: "BuildCo",
    });

    expect(submittal.id).toBe("submittal-1");
    expect(submittal.status).toBe("submitted");
    expect(submittal.reviewHistory).toHaveLength(1);
    expect(submittal.reviewHistory[0].action).toBe("submitted");
  });

  it("moves submittals into review and captures reviewer assignment", () => {
    const submittal = createSubmittal({
      projectId: "proj-1",
      specSection: "09 90 00",
      materialName: "Interior paint system",
      submittedBy: "Procurement Lead",
    });

    const reviewed = reviewSubmittal(submittal.id, {
      reviewer: "Architect",
      reviewerRole: "design",
      reviewedAt: "2025-04-05T12:00:00.000Z",
      comments: "Need confirmation on sheen level",
    });

    expect(reviewed.status).toBe("under_review");
    expect(reviewed.assignedReviewer).toBe("Architect");
    expect(reviewed.assignedReviewerRole).toBe("design");
    expect(reviewed.reviewHistory).toHaveLength(2);
    expect(reviewed.reviewHistory[1].comments).toContain("sheen");
  });

  it("approves submittals and calculates turnaround days in the log", () => {
    const submittal = createSubmittal({
      projectId: "proj-1",
      specSection: "08 44 13",
      materialName: "Curtain wall assembly",
      submittedBy: "Subcontractor",
      submittedAt: "2025-04-01T00:00:00.000Z",
      dueDate: "2025-04-10",
    });

    reviewSubmittal(submittal.id, {
      reviewer: "Facade Consultant",
      reviewedAt: "2025-04-02T00:00:00.000Z",
      comments: "Review started",
    });
    const approved = approveSubmittal(submittal.id, {
      reviewer: "Architect",
      reviewedAt: "2025-04-04T12:00:00.000Z",
      comments: "Approved as submitted",
    });
    const log = generateSubmittalsLog("proj-1");

    expect(approved.status).toBe("approved");
    expect(log).toHaveLength(1);
    expect(log[0].assignedReviewer).toBe("Architect");
    expect(log[0].reviewCycles).toBe(1);
    expect(log[0].turnaroundDays).toBe(3.5);
  });

  it("rejects submittals and preserves project filtering", () => {
    const first = createSubmittal({
      projectId: "proj-1",
      specSection: "03 30 00",
      materialName: "Concrete mix design",
      submittedBy: "Concrete Supplier",
      submittedAt: "2025-04-01T00:00:00.000Z",
    });
    const second = createSubmittal({
      projectId: "proj-2",
      specSection: "04 20 00",
      materialName: "CMU sample",
      submittedBy: "Masonry Supplier",
    });

    rejectSubmittal(first.id, {
      reviewer: "Structural Engineer",
      reviewedAt: "2025-04-03T00:00:00.000Z",
      comments: "Strength class mismatch",
    });

    expect(getSubmittals("proj-1")).toHaveLength(1);
    expect(getSubmittals("proj-2")[0].id).toBe(second.id);
    expect(generateSubmittalsLog("proj-1")[0].status).toBe("rejected");
  });

  it("sorts the log by submission date and throws on unknown ids", () => {
    createSubmittal({
      projectId: "proj-1",
      specSection: "05 50 00",
      materialName: "Metal handrail",
      submittedBy: "Steel Trades",
      submittedAt: "2025-04-03T00:00:00.000Z",
    });
    createSubmittal({
      projectId: "proj-1",
      specSection: "07 62 00",
      materialName: "Sheet metal flashing",
      submittedBy: "Envelope Trades",
      submittedAt: "2025-04-01T00:00:00.000Z",
    });

    const log = generateSubmittalsLog("proj-1");

    expect(log[0].materialName).toBe("Sheet metal flashing");
    expect(log[1].materialName).toBe("Metal handrail");
    expect(() =>
      approveSubmittal("missing", {
        reviewer: "Architect",
      }),
    ).toThrow("Submittal not found: missing");
  });
});
