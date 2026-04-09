import { describe, expect, it } from "vitest";
import { exportToICS } from "./calendar-export.js";
import type { Project, Task } from "../domain/types.js";

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "Test Building",
    description: "A test project",
    status: "active",
    startDate: "2025-07-01",
    endDate: "2025-12-31",
    includeWeekends: false,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "Foundation Work",
    description: "Lay foundation",
    status: "todo",
    startDate: "2025-07-01",
    dueDate: "2025-07-15",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

describe("calendar-export", () => {
  describe("exportToICS", () => {
    it("produces valid iCalendar structure", () => {
      const ics = exportToICS(makeProject(), [makeTask()], "2025-06-01");
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("PRODID:-//GenbaHub//Construction PM//JP");
    });

    it("includes project name as calendar name", () => {
      const ics = exportToICS(makeProject({ name: "KDX南青山" }), [], "2025-06-01");
      expect(ics).toContain("X-WR-CALNAME:KDX南青山");
    });

    it("creates VEVENT for each task with dates", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Task A", startDate: "2025-07-01", dueDate: "2025-07-05" }),
        makeTask({ id: "t2", name: "Task B", startDate: "2025-07-10", dueDate: "2025-07-20" }),
      ];
      const ics = exportToICS(makeProject(), tasks, "2025-06-01");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("SUMMARY:Task A");
      expect(ics).toContain("SUMMARY:Task B");
      // Check date format (VALUE=DATE)
      expect(ics).toContain("DTSTART;VALUE=DATE:20250701");
      expect(ics).toContain("DTEND;VALUE=DATE:20250706"); // exclusive end
    });

    it("skips tasks without startDate", () => {
      const tasks = [makeTask({ startDate: undefined })];
      const ics = exportToICS(makeProject(), tasks, "2025-06-01");
      expect(ics).not.toContain("BEGIN:VEVENT");
    });

    it("uses startDate as end when dueDate is missing", () => {
      const task = makeTask({ startDate: "2025-08-01", dueDate: undefined });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("DTSTART;VALUE=DATE:20250801");
      expect(ics).toContain("DTEND;VALUE=DATE:20250802"); // next day (exclusive)
    });

    it("adds VALARM for tasks starting within 3 days", () => {
      const task = makeTask({ startDate: "2025-07-02" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).toContain("BEGIN:VALARM");
      expect(ics).toContain("TRIGGER:-PT30M");
    });

    it("does not add VALARM for tasks starting more than 3 days away", () => {
      const task = makeTask({ startDate: "2025-07-10" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).not.toContain("BEGIN:VALARM");
    });

    it("adds VALARM for task starting today (0 days away)", () => {
      const task = makeTask({ startDate: "2025-07-01" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).toContain("BEGIN:VALARM");
    });

    it("does not add VALARM for tasks in the past", () => {
      const task = makeTask({ startDate: "2025-06-01" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).not.toContain("BEGIN:VALARM");
    });

    it("sets STATUS:COMPLETED for done tasks", () => {
      const task = makeTask({ status: "done" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("STATUS:COMPLETED");
    });

    it("sets STATUS:CONFIRMED for non-done tasks", () => {
      const task = makeTask({ status: "in_progress" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("STATUS:CONFIRMED");
    });

    it("escapes special characters in text fields", () => {
      const task = makeTask({ name: "Phase 1; Foundation, prep" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("SUMMARY:Phase 1\\; Foundation\\, prep");
    });

    it("includes description when present", () => {
      const task = makeTask({ description: "Excavate and pour" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("DESCRIPTION:Excavate and pour");
    });

    it("generates unique UIDs per task", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A" }),
        makeTask({ id: "t2", name: "B" }),
      ];
      const ics = exportToICS(makeProject(), tasks, "2025-06-01");
      expect(ics).toContain("UID:t1-proj-1@genbahub");
      expect(ics).toContain("UID:t2-proj-1@genbahub");
    });

    it("handles empty task list", () => {
      const ics = exportToICS(makeProject(), [], "2025-06-01");
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).not.toContain("BEGIN:VEVENT");
    });

    it("uses CRLF line endings for RFC 5545 compliance", () => {
      const ics = exportToICS(makeProject(), [makeTask()], "2025-06-01");
      expect(ics).toContain("\r\n");
      // Should not have bare LF
      const withoutCRLF = ics.replace(/\r\n/g, "");
      expect(withoutCRLF).not.toContain("\n");
    });

    it("handles multiple tasks with mixed alarm eligibility", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Soon", startDate: "2025-07-02", dueDate: "2025-07-05" }),
        makeTask({ id: "t2", name: "Far", startDate: "2025-08-01", dueDate: "2025-08-10" }),
        makeTask({ id: "t3", name: "Today", startDate: "2025-07-01", dueDate: "2025-07-03" }),
      ];
      const ics = exportToICS(makeProject(), tasks, "2025-07-01");
      // Count VALARM blocks - should be 2 (Soon at 1 day, Today at 0 days)
      const alarmCount = (ics.match(/BEGIN:VALARM/g) || []).length;
      expect(alarmCount).toBe(2);
    });

    it("handles task with description containing newlines", () => {
      const task = makeTask({ description: "Line 1\nLine 2\nLine 3" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2\\nLine 3");
    });

    it("handles task with backslash in name", () => {
      const task = makeTask({ name: "Phase\\1 work" });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).toContain("SUMMARY:Phase\\\\1 work");
    });

    it("omits DESCRIPTION line when task has no description", () => {
      const task = makeTask({ description: undefined });
      const ics = exportToICS(makeProject(), [task], "2025-06-01");
      expect(ics).not.toContain("DESCRIPTION:");
    });

    it("produces correct VEVENT count matching tasks with startDate", () => {
      const tasks = [
        makeTask({ id: "t1", startDate: "2025-07-01" }),
        makeTask({ id: "t2", startDate: undefined }),
        makeTask({ id: "t3", startDate: "2025-07-10" }),
      ];
      const ics = exportToICS(makeProject(), tasks, "2025-06-01");
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(2);
    });

    it("defaults to current date when today not provided", () => {
      const task = makeTask({ startDate: "2099-01-01" });
      const ics = exportToICS(makeProject(), [task]);
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("DTSTAMP:");
    });

    it("handles VALARM boundary at exactly 3 days", () => {
      const task = makeTask({ startDate: "2025-07-04" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).toContain("BEGIN:VALARM");
    });

    it("no VALARM at 4 days away", () => {
      const task = makeTask({ startDate: "2025-07-05" });
      const ics = exportToICS(makeProject(), [task], "2025-07-01");
      expect(ics).not.toContain("BEGIN:VALARM");
    });
  });
});
