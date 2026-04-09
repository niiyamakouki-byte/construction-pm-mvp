import { beforeEach, describe, expect, it } from "vitest";
import {
  assignPunchListItem,
  clearPunchListItems,
  createPunchListItem,
  generatePunchListReport,
  getPunchListItems,
  resolvePunchListItem,
  updatePunchListItemStatus,
  verifyPunchListItem,
} from "./punch-list.js";

describe("punch-list", () => {
  beforeEach(() => {
    clearPunchListItems();
  });

  it("creates punch list items with generated ids and history", () => {
    const item = createPunchListItem({
      projectId: "proj-1",
      title: "Patch drywall crack",
      description: "Repair hairline crack near lobby ceiling",
      location: "Lobby",
      trade: "drywall",
      priority: "medium",
      createdBy: "QA Lead",
    });

    expect(item.id).toBe("punch-1");
    expect(item.status).toBe("open");
    expect(item.history).toHaveLength(1);
    expect(item.history[0].action).toBe("created");
  });

  it("assigns contractors and tracks status changes", () => {
    const item = createPunchListItem({
      projectId: "proj-1",
      title: "Seal window perimeter",
      description: "Waterproofing missing on south elevation",
      location: "Level 5 South",
      trade: "facade",
      priority: "high",
      createdBy: "Site Engineer",
    });

    const assigned = assignPunchListItem(item.id, {
      contractorId: "ctr-7",
      contractorName: "Alpha Facade",
      assignedBy: "PM",
      assignedAt: "2025-04-01T08:00:00.000Z",
    });
    const inProgress = updatePunchListItemStatus(
      item.id,
      "in_progress",
      "Alpha Facade Supervisor",
      "2025-04-02T08:00:00.000Z",
      "Crew mobilized",
    );

    expect(assigned.status).toBe("assigned");
    expect(assigned.assignedContractorName).toBe("Alpha Facade");
    expect(inProgress.status).toBe("in_progress");
    expect(inProgress.history).toHaveLength(3);
    expect(inProgress.history[2].notes).toBe("Crew mobilized");
  });

  it("tracks resolution and verification details", () => {
    const item = createPunchListItem({
      projectId: "proj-1",
      title: "Touch up paint",
      description: "Paint scuff visible at corridor corner",
      location: "Level 2 Corridor",
      trade: "painting",
      priority: "low",
      createdBy: "Inspector",
    });

    resolvePunchListItem(item.id, {
      resolvedBy: "Painter Foreman",
      resolvedAt: "2025-04-03T09:15:00.000Z",
      notes: "Area repainted and blended",
    });
    const verified = verifyPunchListItem(item.id, {
      verifiedBy: "Inspector",
      verifiedAt: "2025-04-04T07:30:00.000Z",
      notes: "Accepted at walkthrough",
    });

    expect(verified.status).toBe("verified");
    expect(verified.resolvedBy).toBe("Painter Foreman");
    expect(verified.verifiedBy).toBe("Inspector");
    expect(verified.history).toHaveLength(3);
    expect(verified.history[1].action).toBe("resolved");
    expect(verified.history[2].action).toBe("verified");
  });

  it("filters items by project", () => {
    createPunchListItem({
      projectId: "proj-1",
      title: "Replace cracked tile",
      description: "Tile chipped at restroom threshold",
      location: "Restroom",
      trade: "tile",
      priority: "medium",
      createdBy: "Inspector",
    });
    createPunchListItem({
      projectId: "proj-2",
      title: "Adjust door closer",
      description: "Door slams shut",
      location: "Office Entry",
      trade: "hardware",
      priority: "high",
      createdBy: "Inspector",
    });

    expect(getPunchListItems("proj-1")).toHaveLength(1);
    expect(getPunchListItems()).toHaveLength(2);
  });

  it("generates an html report with summary counts and escaped content", () => {
    const first = createPunchListItem({
      projectId: "proj-1",
      title: "Fix <sealant>",
      description: "Sealant gap at canopy beam",
      location: "Canopy",
      trade: "sealants",
      priority: "critical",
      createdBy: "QA Lead",
      createdAt: "2025-04-01T08:00:00.000Z",
    });
    const second = createPunchListItem({
      projectId: "proj-1",
      title: "Re-align signage",
      description: "Signage tilted at lobby",
      location: "Lobby",
      trade: "signage",
      priority: "low",
      createdBy: "QA Lead",
      createdAt: "2025-04-01T09:00:00.000Z",
    });

    assignPunchListItem(first.id, {
      contractorId: "ctr-1",
      contractorName: "Envelope Co",
      assignedBy: "PM",
    });
    resolvePunchListItem(first.id, {
      resolvedBy: "Envelope Co",
      notes: "Sealant replaced",
    });
    verifyPunchListItem(first.id, {
      verifiedBy: "QA Lead",
    });
    assignPunchListItem(second.id, {
      contractorId: "ctr-2",
      contractorName: "Interior Co",
      assignedBy: "PM",
    });

    const report = generatePunchListReport("proj-1");

    expect(report).toContain("Punch List Report");
    expect(report).toContain("Total Items: 2");
    expect(report).toContain("Resolved / Verified: 0 / 1");
    expect(report).toContain("&lt;sealant&gt;");
    expect(report).toContain("Envelope Co");
    expect(report.indexOf("Fix &lt;sealant&gt;")).toBeLessThan(
      report.indexOf("Re-align signage"),
    );
  });

  it("throws when updating an unknown item", () => {
    expect(() =>
      assignPunchListItem("missing", {
        contractorId: "ctr-1",
        contractorName: "Unknown",
        assignedBy: "PM",
      }),
    ).toThrow("Punch list item not found: missing");
  });
});
