import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetCrewBoard,
  addAssignment,
  addCrewMember,
  buildCrewBoardHtml,
  checkConflict,
  getAssignmentsByDate,
  getAssignmentsByMember,
  getAssignmentsByProject,
  getDateRange,
  getUtilizationRate,
  moveAssignment,
  removeAssignment,
  updateCrewMember,
} from "./crew-board.js";

describe("crew-board", () => {
  beforeEach(() => {
    _resetCrewBoard();
  });

  // -------------------------------------------------------------------------
  // CrewMember CRUD
  // -------------------------------------------------------------------------

  describe("addCrewMember", () => {
    it("creates a member with generated id", () => {
      const m = addCrewMember({
        name: "田中太郎",
        company: "ABC建設",
        jobType: "大工",
        skills: ["木工", "型枠"],
      });
      expect(m.id).toBe("member-1");
      expect(m.name).toBe("田中太郎");
      expect(m.company).toBe("ABC建設");
      expect(m.jobType).toBe("大工");
      expect(m.skills).toEqual(["木工", "型枠"]);
    });

    it("increments id for each member", () => {
      const m1 = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const m2 = addCrewMember({ name: "鈴木", company: "B社", jobType: "電気", skills: [] });
      expect(m1.id).toBe("member-1");
      expect(m2.id).toBe("member-2");
    });

    it("trims whitespace from name and company", () => {
      const m = addCrewMember({ name: "  田中  ", company: "  A社  ", jobType: "塗装", skills: [] });
      expect(m.name).toBe("田中");
      expect(m.company).toBe("A社");
    });

    it("throws when name is empty", () => {
      expect(() =>
        addCrewMember({ name: "  ", company: "A社", jobType: "大工", skills: [] }),
      ).toThrow("name is required");
    });

    it("stores optional phone", () => {
      const m = addCrewMember({
        name: "田中",
        company: "A社",
        jobType: "大工",
        phone: "090-1234-5678",
        skills: [],
      });
      expect(m.phone).toBe("090-1234-5678");
    });
  });

  describe("updateCrewMember", () => {
    it("updates fields and returns updated member", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const updated = updateCrewMember(m.id, { jobType: "電気", skills: ["高圧"] });
      expect(updated).not.toBeNull();
      expect(updated!.jobType).toBe("電気");
      expect(updated!.skills).toEqual(["高圧"]);
    });

    it("returns null for unknown id", () => {
      const result = updateCrewMember("no-such-id", { jobType: "電気" });
      expect(result).toBeNull();
    });

    it("throws when updating name to empty string", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      expect(() => updateCrewMember(m.id, { name: "" })).toThrow("name is required");
    });
  });

  // -------------------------------------------------------------------------
  // CrewAssignment CRUD
  // -------------------------------------------------------------------------

  describe("addAssignment", () => {
    it("creates an assignment with generated id", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const a = addAssignment({
        memberId: m.id,
        projectId: "proj-1",
        projectName: "南青山新築",
        date: "2026-04-14",
      });
      expect(a.id).toBe("assign-1");
      expect(a.memberId).toBe(m.id);
      expect(a.projectId).toBe("proj-1");
      expect(a.date).toBe("2026-04-14");
    });

    it("throws when memberId is missing", () => {
      expect(() =>
        addAssignment({ memberId: "", projectId: "p1", projectName: "X", date: "2026-04-14" }),
      ).toThrow("memberId is required");
    });

    it("throws when projectId is missing", () => {
      expect(() =>
        addAssignment({ memberId: "m1", projectId: "", projectName: "X", date: "2026-04-14" }),
      ).toThrow("projectId is required");
    });

    it("throws when date is missing", () => {
      expect(() =>
        addAssignment({ memberId: "m1", projectId: "p1", projectName: "X", date: "" }),
      ).toThrow("date is required");
    });
  });

  describe("removeAssignment", () => {
    it("removes an existing assignment and returns true", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const a = addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      expect(removeAssignment(a.id)).toBe(true);
      expect(getAssignmentsByMember(m.id)).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(removeAssignment("no-such-id")).toBe(false);
    });
  });

  describe("moveAssignment", () => {
    it("moves assignment to a new date", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const a = addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      const moved = moveAssignment(a.id, "2026-04-15");
      expect(moved).not.toBeNull();
      expect(moved!.date).toBe("2026-04-15");
    });

    it("moves assignment to a new project", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const a = addAssignment({ memberId: m.id, projectId: "p1", projectName: "現場A", date: "2026-04-14" });
      const moved = moveAssignment(a.id, "2026-04-16", "p2", "現場B");
      expect(moved!.projectId).toBe("p2");
      expect(moved!.projectName).toBe("現場B");
    });

    it("returns null for unknown id", () => {
      expect(moveAssignment("no-such-id", "2026-04-15")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Query functions
  // -------------------------------------------------------------------------

  describe("getAssignmentsByDate", () => {
    it("returns only assignments for the given date", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-15" });
      expect(getAssignmentsByDate("2026-04-14")).toHaveLength(1);
    });
  });

  describe("getAssignmentsByProject", () => {
    it("returns all assignments for a project", () => {
      const m1 = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const m2 = addCrewMember({ name: "鈴木", company: "B社", jobType: "電気", skills: [] });
      addAssignment({ memberId: m1.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      addAssignment({ memberId: m2.id, projectId: "p1", projectName: "X", date: "2026-04-15" });
      addAssignment({ memberId: m1.id, projectId: "p2", projectName: "Y", date: "2026-04-14" });
      expect(getAssignmentsByProject("p1")).toHaveLength(2);
    });
  });

  describe("getDateRange", () => {
    it("returns assignments within inclusive range", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-13" });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-15" });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-16" });
      const result = getDateRange("2026-04-14", "2026-04-15");
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.date >= "2026-04-14" && a.date <= "2026-04-15")).toBe(true);
    });

    it("returns empty array when no assignments in range", () => {
      const result = getDateRange("2026-05-01", "2026-05-07");
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Conflict detection
  // -------------------------------------------------------------------------

  describe("checkConflict", () => {
    it("detects double-booking on the same day", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "現場A", date: "2026-04-14" });
      const conflicts = checkConflict(m.id, "2026-04-14");
      expect(conflicts).toHaveLength(1);
    });

    it("returns empty array when no conflict", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "現場A", date: "2026-04-14" });
      const conflicts = checkConflict(m.id, "2026-04-15");
      expect(conflicts).toHaveLength(0);
    });

    it("excludes the specified assignment id (for update scenario)", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const a = addAssignment({ memberId: m.id, projectId: "p1", projectName: "現場A", date: "2026-04-14" });
      const conflicts = checkConflict(m.id, "2026-04-14", a.id);
      expect(conflicts).toHaveLength(0);
    });

    it("does not flag different members on same day as conflict", () => {
      const m1 = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      const m2 = addCrewMember({ name: "鈴木", company: "B社", jobType: "電気", skills: [] });
      addAssignment({ memberId: m1.id, projectId: "p1", projectName: "現場A", date: "2026-04-14" });
      const conflicts = checkConflict(m2.id, "2026-04-14");
      expect(conflicts).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Utilization rate
  // -------------------------------------------------------------------------

  describe("getUtilizationRate", () => {
    it("returns 0 when no assignments", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      // 2026-04-14 to 2026-04-18 = Mon–Sat (5 working days, no Sunday)
      const rate = getUtilizationRate(m.id, "2026-04-14", "2026-04-18");
      expect(rate).toBe(0);
    });

    it("returns 1 when assigned every working day", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      // 2026-04-14 (Tue) to 2026-04-18 (Sat) = 5 days, all Mon–Sat
      for (const date of ["2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17", "2026-04-18"]) {
        addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date });
      }
      const rate = getUtilizationRate(m.id, "2026-04-14", "2026-04-18");
      expect(rate).toBe(1);
    });

    it("calculates partial utilization correctly", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      // 2026-04-14–18 = 5 working days, assign 2 of them
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-14" });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "X", date: "2026-04-15" });
      const rate = getUtilizationRate(m.id, "2026-04-14", "2026-04-18");
      expect(rate).toBeCloseTo(2 / 5);
    });

    it("returns 0 when range is empty", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      // Single Sunday — no working days
      const rate = getUtilizationRate(m.id, "2026-04-19", "2026-04-19");
      expect(rate).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // HTML board output
  // -------------------------------------------------------------------------

  describe("buildCrewBoardHtml", () => {
    it("generates a table with crew member rows and date columns", () => {
      addCrewMember({ name: "田中太郎", company: "A社", jobType: "大工", skills: [] });
      const html = buildCrewBoardHtml("2026-04-14", "2026-04-15");
      expect(html).toContain("<table");
      expect(html).toContain("田中太郎");
      expect(html).toContain("04-14");
      expect(html).toContain("04-15");
    });

    it("shows project name in the cell for assigned days", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "南青山新築", date: "2026-04-14" });
      const html = buildCrewBoardHtml("2026-04-14", "2026-04-14");
      expect(html).toContain("南青山新築");
    });

    it("escapes HTML in project name", () => {
      const m = addCrewMember({ name: "田中", company: "A社", jobType: "大工", skills: [] });
      addAssignment({ memberId: m.id, projectId: "p1", projectName: "<script>alert(1)</script>", date: "2026-04-14" });
      const html = buildCrewBoardHtml("2026-04-14", "2026-04-14");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("generates empty table body when no members", () => {
      const html = buildCrewBoardHtml("2026-04-14", "2026-04-14");
      expect(html).toContain("<tbody></tbody>");
    });
  });
});
