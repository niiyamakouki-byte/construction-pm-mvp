import { describe, expect, it, beforeEach } from "vitest";
import {
  addKyActivity,
  addNearMissReport,
  clearAllRecords,
  listKyActivities,
  listNearMissReports,
} from "../lib/safety-records.js";

describe("safety-records", () => {
  beforeEach(() => {
    clearAllRecords();
  });

  describe("KY activities", () => {
    it("adds and retrieves a KY activity", () => {
      const record = addKyActivity({
        date: "2025-07-01",
        participants: ["山田", "鈴木"],
        hazards: ["高所作業での墜落"],
        countermeasures: ["ハーネス装着確認"],
      });

      expect(record.id).toMatch(/^ky-/);
      expect(record.date).toBe("2025-07-01");
      expect(record.participants).toEqual(["山田", "鈴木"]);
      expect(record.hazards).toEqual(["高所作業での墜落"]);
      expect(record.countermeasures).toEqual(["ハーネス装着確認"]);
      expect(record.createdAt).toBeTruthy();
    });

    it("lists activities sorted by date descending", () => {
      addKyActivity({ date: "2025-06-01", participants: ["A"], hazards: ["h1"], countermeasures: ["c1"] });
      addKyActivity({ date: "2025-07-01", participants: ["B"], hazards: ["h2"], countermeasures: ["c2"] });
      addKyActivity({ date: "2025-06-15", participants: ["C"], hazards: ["h3"], countermeasures: ["c3"] });

      const list = listKyActivities();
      expect(list.map((r) => r.date)).toEqual(["2025-07-01", "2025-06-15", "2025-06-01"]);
    });

    it("returns empty array when no records", () => {
      expect(listKyActivities()).toEqual([]);
    });
  });

  describe("near miss reports", () => {
    it("adds and retrieves a near miss report", () => {
      const record = addNearMissReport({
        datetime: "2025-07-01T10:00",
        location: "3階東側",
        description: "工具が落下しそうになった",
        severity: "high",
        causeAnalysis: "工具固定不足",
        countermeasure: "工具ストラップ必須化",
      });

      expect(record.id).toMatch(/^nm-/);
      expect(record.location).toBe("3階東側");
      expect(record.severity).toBe("high");
      expect(record.createdAt).toBeTruthy();
    });

    it("lists reports sorted by datetime descending", () => {
      addNearMissReport({ datetime: "2025-06-01T09:00", location: "A", description: "d1", severity: "low", causeAnalysis: "c1", countermeasure: "m1" });
      addNearMissReport({ datetime: "2025-07-01T09:00", location: "B", description: "d2", severity: "high", causeAnalysis: "c2", countermeasure: "m2" });

      const list = listNearMissReports();
      expect(list[0].location).toBe("B");
      expect(list[1].location).toBe("A");
    });

    it("stores all severity levels", () => {
      addNearMissReport({ datetime: "2025-07-01T10:00", location: "X", description: "d", severity: "medium", causeAnalysis: "c", countermeasure: "m" });
      const list = listNearMissReports();
      expect(list[0].severity).toBe("medium");
    });
  });

  describe("clearAllRecords", () => {
    it("empties both stores", () => {
      addKyActivity({ date: "2025-07-01", participants: ["A"], hazards: ["h"], countermeasures: ["c"] });
      addNearMissReport({ datetime: "2025-07-01T10:00", location: "X", description: "d", severity: "low", causeAnalysis: "c", countermeasure: "m" });

      clearAllRecords();

      expect(listKyActivities()).toHaveLength(0);
      expect(listNearMissReports()).toHaveLength(0);
    });
  });
});
