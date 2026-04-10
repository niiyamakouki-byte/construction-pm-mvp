import { beforeEach, describe, expect, it } from "vitest";
import {
  clearEntryRecords,
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
});
