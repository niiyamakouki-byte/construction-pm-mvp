import { describe, expect, it, beforeEach } from "vitest";
import {
  registerWorker,
  updateWorker,
  getWorkerByCCUSId,
  getAllWorkers,
  recordCCUSEntry,
  recordCCUSExit,
  getCCUSEntriesByDate,
  getCCUSEntriesByProject,
  calculateSkillLevel,
  getCCUSStats,
  buildCCUSReportHtml,
  _resetCCUSStore,
} from "../lib/ccus-integration.js";

describe("ccus-integration", () => {
  beforeEach(() => {
    _resetCCUSStore();
  });

  // ── Worker CRUD ────────────────────────────────

  describe("registerWorker", () => {
    it("技能者を登録して返す", () => {
      const worker = registerWorker({
        ccusId: "12345678901234",
        name: "山田太郎",
        company: "山田建設",
        jobType: "内装",
        skillLevel: 2,
        certifications: ["技能士2級"],
        registeredAt: "2025-01-01T00:00:00.000Z",
      });

      expect(worker.id).toMatch(/^ccus-worker-/);
      expect(worker.ccusId).toBe("12345678901234");
      expect(worker.name).toBe("山田太郎");
      expect(worker.skillLevel).toBe(2);
    });

    it("ccusIdが14桁でない場合エラーを投げる", () => {
      expect(() =>
        registerWorker({
          ccusId: "123",
          name: "テスト",
          company: "テスト株式会社",
          jobType: "大工",
          skillLevel: 1,
          certifications: [],
          registeredAt: "2025-01-01T00:00:00.000Z",
        }),
      ).toThrow("ccusId は14桁");
    });

    it("nameが空の場合エラーを投げる", () => {
      expect(() =>
        registerWorker({
          ccusId: "12345678901234",
          name: "  ",
          company: "テスト株式会社",
          jobType: "大工",
          skillLevel: 1,
          certifications: [],
          registeredAt: "2025-01-01T00:00:00.000Z",
        }),
      ).toThrow("name は必須");
    });
  });

  describe("updateWorker", () => {
    it("技能者情報を更新できる", () => {
      const w = registerWorker({
        ccusId: "11111111111111",
        name: "鈴木一郎",
        company: "鈴木工務店",
        jobType: "電気",
        skillLevel: 1,
        certifications: [],
        registeredAt: "2025-01-01T00:00:00.000Z",
      });

      const updated = updateWorker(w.id, { skillLevel: 3, certifications: ["2級施工管理技士"] });
      expect(updated?.skillLevel).toBe(3);
      expect(updated?.certifications).toContain("2級施工管理技士");
    });

    it("存在しないIDはnullを返す", () => {
      const result = updateWorker("nonexistent", { skillLevel: 2 });
      expect(result).toBeNull();
    });
  });

  describe("getWorkerByCCUSId / getAllWorkers", () => {
    it("CCUS IDで技能者を検索できる", () => {
      registerWorker({
        ccusId: "99999999999999",
        name: "佐藤花子",
        company: "佐藤インテリア",
        jobType: "内装",
        skillLevel: 2,
        certifications: [],
        registeredAt: "2025-01-01T00:00:00.000Z",
      });

      const found = getWorkerByCCUSId("99999999999999");
      expect(found?.name).toBe("佐藤花子");
    });

    it("存在しないCCUS IDはnullを返す", () => {
      expect(getWorkerByCCUSId("00000000000000")).toBeNull();
    });

    it("getAllWorkersは全技能者を返す", () => {
      registerWorker({ ccusId: "11111111111111", name: "A", company: "C", jobType: "j", skillLevel: 1, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });
      registerWorker({ ccusId: "22222222222222", name: "B", company: "C", jobType: "j", skillLevel: 2, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });
      expect(getAllWorkers()).toHaveLength(2);
    });
  });

  // ── Entry / Exit ───────────────────────────────

  describe("recordCCUSEntry / recordCCUSExit", () => {
    it("入場を記録できる", () => {
      registerWorker({ ccusId: "12345678901234", name: "田中", company: "田中工業", jobType: "大工", skillLevel: 1, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });

      const entry = recordCCUSEntry("12345678901234", "proj-001");
      expect(entry.id).toMatch(/^ccus-entry-/);
      expect(entry.ccusId).toBe("12345678901234");
      expect(entry.projectId).toBe("proj-001");
      expect(entry.entryTime).toBeTruthy();
      expect(entry.exitTime).toBeUndefined();
    });

    it("退場を記録すると workedHours が計算される", () => {
      registerWorker({ ccusId: "12345678901234", name: "田中", company: "田中工業", jobType: "大工", skillLevel: 1, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });
      const entry = recordCCUSEntry("12345678901234", "proj-001");

      // entryTime を過去に書き換えて workedHours を確認
      const record = getCCUSEntriesByProject("proj-001")[0];
      record.entryTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

      const exited = recordCCUSExit(entry.id);
      expect(exited?.exitTime).toBeTruthy();
      expect(exited?.workedHours).toBeGreaterThan(0);
    });

    it("存在しないentryRecordIdはnullを返す", () => {
      expect(recordCCUSExit("nonexistent")).toBeNull();
    });

    it("未登録技能者の入場はエラー", () => {
      expect(() => recordCCUSEntry("00000000000000", "proj-001")).toThrow("技能者が見つかりません");
    });
  });

  describe("getCCUSEntriesByDate / getCCUSEntriesByProject", () => {
    it("日付でフィルタリングできる", () => {
      registerWorker({ ccusId: "12345678901234", name: "A", company: "C", jobType: "j", skillLevel: 1, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });
      recordCCUSEntry("12345678901234", "proj-001");

      const today = new Date().toISOString().slice(0, 10);
      const entries = getCCUSEntriesByDate(today);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("プロジェクトIDでフィルタリングできる", () => {
      registerWorker({ ccusId: "12345678901234", name: "A", company: "C", jobType: "j", skillLevel: 1, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });
      recordCCUSEntry("12345678901234", "proj-001");
      recordCCUSEntry("12345678901234", "proj-002");

      expect(getCCUSEntriesByProject("proj-001")).toHaveLength(1);
      expect(getCCUSEntriesByProject("proj-002")).toHaveLength(1);
    });
  });

  // ── Skill level calculation ────────────────────

  describe("calculateSkillLevel", () => {
    it("1級施工管理技士 → レベル4", () => {
      expect(calculateSkillLevel(["1級施工管理技士"], 0)).toBe(4);
    });

    it("経験10年以上 → レベル4", () => {
      expect(calculateSkillLevel([], 10)).toBe(4);
    });

    it("2級施工管理技士 → レベル3", () => {
      expect(calculateSkillLevel(["2級施工管理技士"], 0)).toBe(3);
    });

    it("経験5年以上 → レベル3", () => {
      expect(calculateSkillLevel([], 5)).toBe(3);
    });

    it("技能士資格 → レベル2", () => {
      expect(calculateSkillLevel(["内装技能士2級"], 0)).toBe(2);
    });

    it("経験3年以上 → レベル2", () => {
      expect(calculateSkillLevel([], 3)).toBe(2);
    });

    it("資格なし・経験1年 → レベル1", () => {
      expect(calculateSkillLevel([], 1)).toBe(1);
    });

    it("上位資格が優先される", () => {
      expect(calculateSkillLevel(["1級施工管理技士", "技能士2級"], 2)).toBe(4);
    });
  });

  // ── Statistics ─────────────────────────────────

  describe("getCCUSStats", () => {
    it("プロジェクトの統計を返す", () => {
      registerWorker({ ccusId: "11111111111111", name: "A", company: "C", jobType: "j", skillLevel: 2, certifications: ["技能士"], registeredAt: "2025-01-01T00:00:00.000Z" });
      registerWorker({ ccusId: "22222222222222", name: "B", company: "C", jobType: "j", skillLevel: 4, certifications: [], registeredAt: "2025-01-01T00:00:00.000Z" });

      recordCCUSEntry("11111111111111", "proj-stats");
      recordCCUSEntry("22222222222222", "proj-stats");

      const stats = getCCUSStats("proj-stats");
      expect(stats.totalWorkers).toBe(2);
      expect(stats.averageSkillLevel).toBe(3);
      expect(stats.certificationRate).toBe(0.5);
      expect(stats.levelBreakdown[2]).toBe(1);
      expect(stats.levelBreakdown[4]).toBe(1);
    });

    it("入場記録のないプロジェクトはゼロ統計を返す", () => {
      const stats = getCCUSStats("empty-proj");
      expect(stats.totalWorkers).toBe(0);
      expect(stats.averageSkillLevel).toBe(0);
      expect(stats.certificationRate).toBe(0);
    });
  });

  // ── HTML Report ────────────────────────────────

  describe("buildCCUSReportHtml", () => {
    it("有効なHTMLを生成する", () => {
      registerWorker({ ccusId: "12345678901234", name: "山田太郎", company: "山田建設", jobType: "内装", skillLevel: 2, certifications: ["技能士"], registeredAt: "2025-01-01T00:00:00.000Z" });
      recordCCUSEntry("12345678901234", "proj-html");

      const html = buildCCUSReportHtml("proj-html", "テスト現場");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("CCUS実績報告書");
      expect(html).toContain("テスト現場");
      expect(html).toContain("山田太郎");
      expect(html).toContain("12345678901234");
    });

    it("技能者がいない場合でも有効なHTMLを返す", () => {
      const html = buildCCUSReportHtml("empty-proj", "空の現場");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("技能者データなし");
    });
  });
});
