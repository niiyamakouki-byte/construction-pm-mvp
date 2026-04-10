import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateManDays,
  clearEntryRecords,
  exportToCSV,
  getEntriesByCompany,
  getEntryLog,
  getTodayWorkerCount,
  logEntry,
  logExit,
} from "./site-entry-log.js";

describe("site-entry-log", () => {
  beforeEach(() => {
    clearEntryRecords();
  });

  describe("logEntry", () => {
    it("creates an entry record with generated id", () => {
      const record = logEntry("proj-1", "田中太郎", "ABC建設");
      expect(record.id).toBe("entry-1");
      expect(record.projectId).toBe("proj-1");
      expect(record.workerName).toBe("田中太郎");
      expect(record.company).toBe("ABC建設");
      expect(record.entryTime).toBeTruthy();
      expect(record.exitTime).toBeUndefined();
    });

    it("increments id for multiple entries", () => {
      const r1 = logEntry("proj-1", "田中太郎", "ABC建設");
      const r2 = logEntry("proj-1", "鈴木花子", "XYZ工務店");
      expect(r1.id).toBe("entry-1");
      expect(r2.id).toBe("entry-2");
    });

    it("trims whitespace from workerName and company", () => {
      const record = logEntry("proj-1", "  田中  ", "  ABC建設  ");
      expect(record.workerName).toBe("田中");
      expect(record.company).toBe("ABC建設");
    });

    it("throws if projectId is empty", () => {
      expect(() => logEntry("", "田中", "ABC")).toThrow("projectId is required");
    });

    it("throws if workerName is empty", () => {
      expect(() => logEntry("proj-1", "  ", "ABC")).toThrow("workerName is required");
    });
  });

  describe("logExit", () => {
    it("sets exitTime on existing record", () => {
      const entry = logEntry("proj-1", "田中太郎", "ABC建設");
      const updated = logExit(entry.id);
      expect(updated).not.toBeNull();
      expect(updated!.exitTime).toBeTruthy();
      expect(updated!.id).toBe(entry.id);
    });

    it("returns null for unknown record id", () => {
      const result = logExit("unknown-id");
      expect(result).toBeNull();
    });
  });

  describe("getEntryLog", () => {
    it("returns all records for a project", () => {
      logEntry("proj-1", "田中", "A社");
      logEntry("proj-1", "鈴木", "B社");
      logEntry("proj-2", "佐藤", "C社");

      const log = getEntryLog("proj-1");
      expect(log).toHaveLength(2);
      expect(log.every((r) => r.projectId === "proj-1")).toBe(true);
    });

    it("filters by date when provided", () => {
      logEntry("proj-1", "田中", "A社");
      const today = new Date().toISOString().slice(0, 10);
      const log = getEntryLog("proj-1", today);
      expect(log).toHaveLength(1);
    });

    it("returns empty array for non-existent date", () => {
      logEntry("proj-1", "田中", "A社");
      const log = getEntryLog("proj-1", "1990-01-01");
      expect(log).toHaveLength(0);
    });

    it("returns empty array for unknown project", () => {
      logEntry("proj-1", "田中", "A社");
      const log = getEntryLog("proj-999");
      expect(log).toHaveLength(0);
    });
  });

  describe("getTodayWorkerCount", () => {
    it("counts workers currently on site (no exit)", () => {
      logEntry("proj-1", "田中", "A社");
      logEntry("proj-1", "鈴木", "B社");
      expect(getTodayWorkerCount("proj-1")).toBe(2);
    });

    it("excludes workers who have exited", () => {
      const entry = logEntry("proj-1", "田中", "A社");
      logEntry("proj-1", "鈴木", "B社");
      logExit(entry.id);
      expect(getTodayWorkerCount("proj-1")).toBe(1);
    });

    it("returns 0 when no workers on site", () => {
      expect(getTodayWorkerCount("proj-1")).toBe(0);
    });

    it("does not count workers from other projects", () => {
      logEntry("proj-2", "田中", "A社");
      expect(getTodayWorkerCount("proj-1")).toBe(0);
    });
  });

  describe("getEntriesByCompany", () => {
    it("groups records by company", () => {
      logEntry("proj-1", "田中", "A社");
      logEntry("proj-1", "鈴木", "A社");
      logEntry("proj-1", "佐藤", "B社");

      const map = getEntriesByCompany("proj-1");
      expect(map.get("A社")).toHaveLength(2);
      expect(map.get("B社")).toHaveLength(1);
    });

    it("uses fallback key for empty company", () => {
      logEntry("proj-1", "田中", "");
      const map = getEntriesByCompany("proj-1");
      expect(map.has("（会社未設定）")).toBe(true);
    });

    it("filters by date", () => {
      logEntry("proj-1", "田中", "A社");
      const today = new Date().toISOString().slice(0, 10);
      const map = getEntriesByCompany("proj-1", today);
      expect(map.get("A社")).toHaveLength(1);
    });

    it("returns empty map for unknown project", () => {
      const map = getEntriesByCompany("no-project");
      expect(map.size).toBe(0);
    });
  });

  describe("calculateManDays", () => {
    it("returns 0 when no completed entries", () => {
      const entry = logEntry("proj-1", "田中", "A社");
      expect(calculateManDays([entry])).toBe(0);
    });

    it("calculates 1 man-day for exactly 8 hours", () => {
      const entry = logEntry("proj-1", "田中", "A社");
      entry.exitTime = new Date(
        new Date(entry.entryTime).getTime() + 8 * 60 * 60 * 1000,
      ).toISOString();
      expect(calculateManDays([entry])).toBe(1);
    });

    it("calculates 0.5 man-day for 4 hours", () => {
      const entry = logEntry("proj-1", "田中", "A社");
      entry.exitTime = new Date(
        new Date(entry.entryTime).getTime() + 4 * 60 * 60 * 1000,
      ).toISOString();
      expect(calculateManDays([entry])).toBe(0.5);
    });

    it("adds 0.25 per overtime hour beyond 8h", () => {
      const entry = logEntry("proj-1", "田中", "A社");
      entry.exitTime = new Date(
        new Date(entry.entryTime).getTime() + 10 * 60 * 60 * 1000,
      ).toISOString();
      // 1 (8h) + 2 * 0.25 = 1.5
      expect(calculateManDays([entry])).toBe(1.5);
    });

    it("sums across multiple entries", () => {
      const e1 = logEntry("proj-1", "田中", "A社");
      const e2 = logEntry("proj-1", "鈴木", "A社");
      e1.exitTime = new Date(
        new Date(e1.entryTime).getTime() + 8 * 60 * 60 * 1000,
      ).toISOString();
      e2.exitTime = new Date(
        new Date(e2.entryTime).getTime() + 8 * 60 * 60 * 1000,
      ).toISOString();
      expect(calculateManDays([e1, e2])).toBe(2);
    });
  });

  describe("exportToCSV", () => {
    it("returns header row plus data rows", () => {
      const entry = logEntry("proj-1", "田中太郎", "ABC建設");
      entry.exitTime = new Date(
        new Date(entry.entryTime).getTime() + 8 * 60 * 60 * 1000,
      ).toISOString();
      const csv = exportToCSV([entry]);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("ID,氏名,会社,入場時刻,退場時刻,勤務時間(h),人工");
      expect(lines[1]).toContain("田中太郎");
      expect(lines[1]).toContain("ABC建設");
    });

    it("leaves exit columns empty when no exit time", () => {
      const entry = logEntry("proj-1", "田中太郎", "ABC建設");
      const csv = exportToCSV([entry]);
      const lines = csv.split("\n");
      // columns 5 and 6 (hours, manDays) should be empty
      const cols = lines[1].split(",");
      expect(cols[5]).toBe("");
      expect(cols[6]).toBe("");
    });

    it("escapes double quotes in fields", () => {
      const entry = logEntry('proj-1', 'Test "quoted"', 'A社');
      const csv = exportToCSV([entry]);
      expect(csv).toContain('Test ""quoted""');
    });

    it("returns only header for empty entries array", () => {
      const csv = exportToCSV([]);
      expect(csv).toBe("ID,氏名,会社,入場時刻,退場時刻,勤務時間(h),人工");
    });
  });
});
