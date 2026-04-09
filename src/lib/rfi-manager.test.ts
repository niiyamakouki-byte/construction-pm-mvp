import { beforeEach, describe, expect, it } from "vitest";
import {
  assignRFI,
  calculateRFIResponseHours,
  clearRFIs,
  closeRFI,
  createRFI,
  generateRFILog,
  getRFIs,
  respondToRFI,
} from "./rfi-manager.js";

describe("rfi-manager", () => {
  beforeEach(() => {
    clearRFIs();
  });

  it("creates rfis with generated ids and initial history", () => {
    const rfi = createRFI({
      projectId: "proj-1",
      subject: "Fireproofing thickness at beams",
      question: "Confirm required thickness at transfer beam zone.",
      requestedBy: "Site Engineer",
      dueDate: "2025-04-10",
    });

    expect(rfi.id).toBe("rfi-1");
    expect(rfi.status).toBe("open");
    expect(rfi.history).toHaveLength(1);
    expect(rfi.history[0].action).toBe("created");
  });

  it("assigns rfis and records the assignee", () => {
    const rfi = createRFI({
      projectId: "proj-1",
      subject: "Partition head detail",
      question: "Need clarification on top-of-wall bracing detail.",
      requestedBy: "GC PM",
    });

    const assigned = assignRFI(rfi.id, {
      assignee: "Architect",
      assignedBy: "GC PM",
      assignedAt: "2025-04-02T08:00:00.000Z",
      notes: "Priority for framing release",
    });

    expect(assigned.status).toBe("assigned");
    expect(assigned.assignedTo).toBe("Architect");
    expect(assigned.history[1].notes).toContain("Priority");
  });

  it("tracks response hours and closes answered rfis", () => {
    const rfi = createRFI({
      projectId: "proj-1",
      subject: "Anchor bolt embed depth",
      question: "Please confirm embed depth for revised base plate.",
      requestedBy: "Field Engineer",
      createdAt: "2025-04-01T08:00:00.000Z",
      dueDate: "2025-04-03T08:00:00.000Z",
    });

    respondToRFI(rfi.id, {
      respondedBy: "Structural Engineer",
      respondedAt: "2025-04-02T14:00:00.000Z",
      answer: "Use 300 mm minimum embedment per SK-12.",
    });
    const closed = closeRFI(
      rfi.id,
      "Field Engineer",
      "2025-04-02T16:00:00.000Z",
      "Issued to steel fabricator",
    );

    expect(calculateRFIResponseHours(rfi.id)).toBe(30);
    expect(closed.status).toBe("closed");
    expect(closed.history[2].action).toBe("closed");
  });

  it("generates an rfi log with overdue detection and filtering", () => {
    const answered = createRFI({
      projectId: "proj-1",
      subject: "Roof drain invert elevation",
      question: "Confirm final drain invert after slab slope revision.",
      requestedBy: "MEP Coordinator",
      createdAt: "2025-04-01T00:00:00.000Z",
      dueDate: "2025-04-04T00:00:00.000Z",
    });
    const open = createRFI({
      projectId: "proj-1",
      subject: "Glazing frit pattern",
      question: "Need approved frit pattern before glass release.",
      requestedBy: "Facade PM",
      createdAt: "2025-04-02T00:00:00.000Z",
      dueDate: "2025-04-03T00:00:00.000Z",
    });
    createRFI({
      projectId: "proj-2",
      subject: "Out-of-scope",
      question: "Different project item",
      requestedBy: "Other PM",
    });

    assignRFI(answered.id, {
      assignee: "Civil Engineer",
      assignedBy: "MEP Coordinator",
    });
    respondToRFI(answered.id, {
      respondedBy: "Civil Engineer",
      respondedAt: "2025-04-01T12:00:00.000Z",
      answer: "Invert remains at 102.450.",
    });

    const log = generateRFILog("proj-1", "2025-04-05T00:00:00.000Z");

    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe("Roof drain invert elevation");
    expect(log[0].responseHours).toBe(12);
    expect(log[0].isOverdue).toBe(false);
    expect(log[1].id).toBe(open.id);
    expect(log[1].isOverdue).toBe(true);
  });

  it("throws on unknown ids and filters by project", () => {
    createRFI({
      projectId: "proj-1",
      subject: "Ceiling support spacing",
      question: "Clarify spacing at bulkhead transition.",
      requestedBy: "Superintendent",
    });

    expect(getRFIs("proj-1")).toHaveLength(1);
    expect(() => calculateRFIResponseHours("missing")).toThrow(
      "RFI not found: missing",
    );
  });
});
