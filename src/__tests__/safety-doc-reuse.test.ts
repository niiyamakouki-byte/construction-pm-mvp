import { describe, it, expect, beforeEach } from "vitest";
import {
  addSafetyDocTemplate,
  createSafetyDocFromTemplate,
  listReusableTemplates,
  mergeSafetyDocFields,
  buildSafetyDocHtml,
  validateSafetyDoc,
  getRequiredDocTypes,
  _resetSafetyDocStore,
  type SafetyDocTemplate,
} from "../lib/safety-doc-reuse.js";

describe("safety-doc-reuse", () => {
  beforeEach(() => {
    _resetSafetyDocStore();
  });

  // ── createSafetyDocFromTemplate ───────────────────

  describe("createSafetyDocFromTemplate", () => {
    it("再利用可能テンプレートから新しい現場ドキュメントを作成できる", () => {
      const tmpl = addSafetyDocTemplate({
        type: "worker-roster",
        projectId: "proj-001",
        orgId: "org-A",
        fields: {
          projectName: "○○現場",
          companyName: "山田建設",
          workerName: "山田太郎",
          role: "大工",
        },
        reusable: true,
      });

      const newDoc = createSafetyDocFromTemplate(tmpl.id, "proj-002");

      expect(newDoc.projectId).toBe("proj-002");
      expect(newDoc.type).toBe("worker-roster");
      expect(newDoc.fields.companyName).toBe("山田建設");
      expect(newDoc.fields.projectName).toBe(""); // 転用先でリセット済み
      expect(newDoc.reusable).toBe(false);
      expect(newDoc.id).not.toBe(tmpl.id);
    });

    it("存在しないテンプレートIDはエラーを投げる", () => {
      expect(() => createSafetyDocFromTemplate("nonexistent", "proj-002")).toThrow(
        "テンプレートが見つかりません",
      );
    });

    it("reusable=false のテンプレートはエラーを投げる", () => {
      const tmpl = addSafetyDocTemplate({
        type: "ky-sheet",
        projectId: "proj-001",
        orgId: "org-A",
        fields: { projectName: "現場A" },
        reusable: false,
      });

      expect(() => createSafetyDocFromTemplate(tmpl.id, "proj-002")).toThrow(
        "再利用不可",
      );
    });

    it("targetProjectId が空の場合エラーを投げる", () => {
      const tmpl = addSafetyDocTemplate({
        type: "worker-roster",
        projectId: "proj-001",
        orgId: "org-A",
        fields: {},
        reusable: true,
      });

      expect(() => createSafetyDocFromTemplate(tmpl.id, "")).toThrow(
        "targetProjectId は必須",
      );
    });
  });

  // ── listReusableTemplates ─────────────────────────

  describe("listReusableTemplates", () => {
    beforeEach(() => {
      addSafetyDocTemplate({ type: "worker-roster", projectId: "p1", orgId: "org-A", fields: {}, reusable: true });
      addSafetyDocTemplate({ type: "ky-sheet", projectId: "p2", orgId: "org-A", fields: {}, reusable: true });
      addSafetyDocTemplate({ type: "work-plan", projectId: "p3", orgId: "org-A", fields: {}, reusable: false });
      addSafetyDocTemplate({ type: "worker-roster", projectId: "p4", orgId: "org-B", fields: {}, reusable: true });
    });

    it("組織IDで再利用可能テンプレートを絞り込める", () => {
      const templates = listReusableTemplates("org-A");
      expect(templates).toHaveLength(2);
      expect(templates.every((t) => t.orgId === "org-A" && t.reusable)).toBe(true);
    });

    it("書類種別でさらにフィルタリングできる", () => {
      const templates = listReusableTemplates("org-A", "worker-roster");
      expect(templates).toHaveLength(1);
      expect(templates[0].type).toBe("worker-roster");
    });

    it("存在しない組織IDは空配列を返す", () => {
      expect(listReusableTemplates("nonexistent-org")).toHaveLength(0);
    });

    it("reusable=false は含まれない", () => {
      const templates = listReusableTemplates("org-A", "work-plan");
      expect(templates).toHaveLength(0);
    });
  });

  // ── mergeSafetyDocFields ──────────────────────────

  describe("mergeSafetyDocFields", () => {
    it("テンプレートフィールドをオーバーライドで上書きできる", () => {
      const tmpl: SafetyDocTemplate = {
        id: "t1",
        type: "worker-roster",
        projectId: "p1",
        orgId: "org-A",
        fields: { projectName: "旧現場", companyName: "A社" },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: true,
      };

      const merged = mergeSafetyDocFields(tmpl, { projectName: "新現場", workerName: "鈴木" });
      expect(merged.projectName).toBe("新現場");
      expect(merged.companyName).toBe("A社");
      expect(merged.workerName).toBe("鈴木");
    });

    it("overrides が空でもテンプレートフィールドがそのまま返る", () => {
      const tmpl: SafetyDocTemplate = {
        id: "t1",
        type: "ky-sheet",
        projectId: "p1",
        orgId: "org-A",
        fields: { projectName: "現場X", hazards: "高所作業" },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: true,
      };

      const merged = mergeSafetyDocFields(tmpl, {});
      expect(merged).toEqual(tmpl.fields);
    });
  });

  // ── buildSafetyDocHtml ────────────────────────────

  describe("buildSafetyDocHtml", () => {
    it("worker-roster の有効なHTMLを生成する", () => {
      const doc: SafetyDocTemplate = {
        id: "d1",
        type: "worker-roster",
        projectId: "proj-001",
        orgId: "org-A",
        fields: { projectName: "テスト現場", companyName: "ABC建設", workerName: "田中太郎", role: "大工" },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const html = buildSafetyDocHtml(doc);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("作業員名簿");
      expect(html).toContain("テスト現場");
      expect(html).toContain("田中太郎");
    });

    it("ky-sheet のタイトルが正しい", () => {
      const doc: SafetyDocTemplate = {
        id: "d2",
        type: "ky-sheet",
        projectId: "proj-002",
        orgId: "org-A",
        fields: { projectName: "KY現場" },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const html = buildSafetyDocHtml(doc);
      expect(html).toContain("KYシート");
    });

    it("XSS対策: 特殊文字がエスケープされる", () => {
      const doc: SafetyDocTemplate = {
        id: "d3",
        type: "work-plan",
        projectId: "proj-003",
        orgId: "org-A",
        fields: { projectName: '<script>alert("xss")</script>' },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const html = buildSafetyDocHtml(doc);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("配列フィールドは読点で結合される", () => {
      const doc: SafetyDocTemplate = {
        id: "d4",
        type: "risk-assessment",
        projectId: "proj-004",
        orgId: "org-A",
        fields: { riskItems: ["墜落", "感電", "挟まれ"] },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const html = buildSafetyDocHtml(doc);
      expect(html).toContain("墜落、感電、挟まれ");
    });
  });

  // ── validateSafetyDoc ─────────────────────────────

  describe("validateSafetyDoc", () => {
    it("必須フィールドが揃っていればエラーなし", () => {
      const doc: SafetyDocTemplate = {
        id: "d1",
        type: "worker-roster",
        projectId: "proj-001",
        orgId: "org-A",
        fields: {
          projectName: "現場A",
          companyName: "A社",
          workerName: "山田",
          role: "大工",
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      expect(validateSafetyDoc(doc)).toHaveLength(0);
    });

    it("必須フィールドが欠けている場合にエラーを返す", () => {
      const doc: SafetyDocTemplate = {
        id: "d2",
        type: "new-entry-education",
        projectId: "proj-001",
        orgId: "org-A",
        fields: { projectName: "現場A" }, // workerName, educationDate, instructor が欠け
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const errors = validateSafetyDoc(doc);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === "workerName")).toBe(true);
      expect(errors.some((e) => e.field === "educationDate")).toBe(true);
    });

    it("空文字フィールドはエラーになる", () => {
      const doc: SafetyDocTemplate = {
        id: "d3",
        type: "work-plan",
        projectId: "proj-001",
        orgId: "org-A",
        fields: {
          projectName: "",
          workDescription: "作業内容",
          startDate: "2025-04-01",
          supervisor: "監督A",
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const errors = validateSafetyDoc(doc);
      expect(errors.some((e) => e.field === "projectName")).toBe(true);
    });

    it("空配列フィールドはエラーになる", () => {
      const doc: SafetyDocTemplate = {
        id: "d4",
        type: "ky-sheet",
        projectId: "proj-001",
        orgId: "org-A",
        fields: {
          projectName: "現場B",
          workDate: "2025-04-13",
          hazards: [],
          countermeasures: "対策あり",
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        reusable: false,
      };

      const errors = validateSafetyDoc(doc);
      expect(errors.some((e) => e.field === "hazards")).toBe(true);
    });
  });

  // ── getRequiredDocTypes ───────────────────────────

  describe("getRequiredDocTypes", () => {
    it("内装工事の必須書類リストを返す", () => {
      const types = getRequiredDocTypes("内装");
      expect(types).toContain("worker-roster");
      expect(types).toContain("new-entry-education");
      expect(types).toContain("ky-sheet");
    });

    it("新築工事は全種別が必要", () => {
      const types = getRequiredDocTypes("新築");
      expect(types).toContain("worker-roster");
      expect(types).toContain("new-entry-education");
      expect(types).toContain("work-plan");
      expect(types).toContain("ky-sheet");
      expect(types).toContain("risk-assessment");
    });

    it("未知の工事種別はデフォルトを返す", () => {
      const types = getRequiredDocTypes("謎の工事");
      expect(types).toContain("worker-roster");
      expect(types).toContain("new-entry-education");
    });

    it("解体工事はリスクアセスメントが必要", () => {
      const types = getRequiredDocTypes("解体");
      expect(types).toContain("risk-assessment");
      expect(types).toContain("work-plan");
    });
  });
});
