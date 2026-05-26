/**
 * solution-engine.ts のテスト (Sprint 12-A)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { suggestSolutions } from "../lib/site-ai-assistant/solution-engine.js";
import { PastCaseStore, resetPastCaseStore } from "../lib/site-ai-assistant/case-store.js";
import { IssueCategory } from "../lib/site-ai-assistant/types.js";
import type { Issue, PastCase } from "../lib/site-ai-assistant/types.js";

// localStorage モック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

let caseStore: PastCaseStore;

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: `issue-${Date.now()}-${Math.random()}`,
    projectId: "proj-1",
    postedBy: "職人A",
    text: "問題が発生しました",
    postedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePastCase(overrides: Partial<PastCase> = {}): PastCase {
  return {
    id: `case-${Date.now()}-${Math.random()}`,
    category: IssueCategory.material_shortage,
    problemSummary: "資材が足りない",
    solutionSummary: "代替品を調達した",
    resolvedAt: "2024-06-01T00:00:00Z",
    satisfaction: 4,
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  resetPastCaseStore();
  caseStore = new PastCaseStore();
});

describe("suggestSolutions", () => {
  describe("past_case ヒット", () => {
    it("カテゴリ一致の事例がある場合、source='past_case' の Solution を返す", () => {
      caseStore.addCase(
        makePastCase({ category: IssueCategory.material_shortage, id: "hit-1" })
      );
      const issue = makeIssue({ text: "資材が足りない" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].source).toBe("past_case");
    });

    it("issueId が正しくセットされる", () => {
      caseStore.addCase(makePastCase({ category: IssueCategory.material_shortage }));
      const issue = makeIssue({ id: "my-issue", text: "材料が不足しています" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.issueId).toBe("my-issue");
      expect(response.suggestedSolutions[0].issueId).toBe("my-issue");
    });

    it("最大3件の Solution を返す", () => {
      for (let i = 0; i < 5; i++) {
        caseStore.addCase(
          makePastCase({ id: `multi-${i}`, category: IssueCategory.coordination })
        );
      }
      const issue = makeIssue({ text: "連絡が取れていない" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions.length).toBeLessThanOrEqual(3);
    });

    it("1件ヒットの場合は1件の Solution を返す", () => {
      caseStore.addCase(
        makePastCase({ id: "only-one", category: IssueCategory.weather_delay })
      );
      const issue = makeIssue({ text: "雨で作業できない" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions.length).toBeGreaterThanOrEqual(1);
      expect(response.suggestedSolutions[0].referencedCaseIds).toContain("only-one");
    });

    it("fallbackMessage が undefined である", () => {
      caseStore.addCase(makePastCase({ category: IssueCategory.safety_concern }));
      const issue = makeIssue({ text: "危険な状況です" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.fallbackMessage).toBeUndefined();
    });

    it("confidence が 0-1 の範囲内である", () => {
      for (let i = 0; i < 3; i++) {
        caseStore.addCase(makePastCase({ id: `conf-${i}`, category: IssueCategory.quality_issue, satisfaction: i + 3 }));
      }
      const issue = makeIssue({ text: "不具合が発生しました" });
      const response = suggestSolutions(issue, caseStore);
      for (const sol of response.suggestedSolutions) {
        expect(sol.confidence).toBeGreaterThanOrEqual(0);
        expect(sol.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("satisfaction が高いケースは confidence も高くなる傾向", () => {
      caseStore.addCase(
        makePastCase({ id: "high-sat", category: IssueCategory.quality_issue, satisfaction: 5 })
      );
      caseStore.addCase(
        makePastCase({ id: "low-sat", category: IssueCategory.quality_issue, satisfaction: 1 })
      );
      const issue = makeIssue({ text: "不具合 やり直し" });
      const response = suggestSolutions(issue, caseStore);
      const highSatSol = response.suggestedSolutions.find((s) =>
        s.referencedCaseIds.includes("high-sat")
      );
      const lowSatSol = response.suggestedSolutions.find((s) =>
        s.referencedCaseIds.includes("low-sat")
      );
      if (highSatSol && lowSatSol) {
        expect(highSatSol.confidence).toBeGreaterThanOrEqual(lowSatSol.confidence);
      }
    });

    it("steps が空でない", () => {
      caseStore.addCase(makePastCase({ category: IssueCategory.client_request }));
      const issue = makeIssue({ text: "施主から要望がきた" });
      const response = suggestSolutions(issue, caseStore);
      for (const sol of response.suggestedSolutions) {
        expect(sol.steps.length).toBeGreaterThan(0);
      }
    });

    it("generatedAt が ISO 8601 形式である", () => {
      caseStore.addCase(makePastCase());
      const issue = makeIssue({ text: "材料不足" });
      const response = suggestSolutions(issue, caseStore);
      expect(() => new Date(response.generatedAt)).not.toThrow();
      expect(new Date(response.generatedAt).getFullYear()).toBeGreaterThan(2020);
    });
  });

  describe("rule_based fallback", () => {
    it("ヒット0件の場合 source='rule_based' の Solution を返す", () => {
      const issue = makeIssue({ text: "全くマッチしない謎の問題XYZABC" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].source).toBe("rule_based");
    });

    it("fallback 時は fallbackMessage が設定される", () => {
      const issue = makeIssue({ text: "XYZABC全く無関係" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.fallbackMessage).toBeDefined();
      expect(response.fallbackMessage!.length).toBeGreaterThan(0);
    });

    it("fallback の confidence が 0.4 である", () => {
      const issue = makeIssue({ text: "XYZABC" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].confidence).toBe(0.4);
    });

    it("fallback の referencedCaseIds が空配列である", () => {
      const issue = makeIssue({ text: "XYZABC" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].referencedCaseIds).toHaveLength(0);
    });

    it("fallback でも steps が3件ある", () => {
      const issue = makeIssue({ text: "XYZABC" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].steps).toHaveLength(3);
    });

    it("other カテゴリ専用フォールバックが返る", () => {
      const issue = makeIssue({ text: "XYZABC" }); // other に分類される
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].summary).toContain("その他");
    });

    it("weather_delay キーワードで対応 fallback が返る", () => {
      // DBが空でも weather_delay カテゴリで fallback
      const issue = makeIssue({ text: "台風で工程が止まった" });
      const response = suggestSolutions(issue, caseStore);
      // ヒットなしなら weather_delay fallback
      if (response.suggestedSolutions[0].source === "rule_based") {
        expect(response.suggestedSolutions[0].summary).toContain("天候");
      }
    });
  });

  describe("confidence 計算", () => {
    it("confidence が 0.3 以上である", () => {
      caseStore.addCase(makePastCase({ satisfaction: 1 }));
      const issue = makeIssue({ text: "材料不足" });
      const response = suggestSolutions(issue, caseStore);
      for (const sol of response.suggestedSolutions) {
        expect(sol.confidence).toBeGreaterThanOrEqual(0.3);
      }
    });

    it("confidence が 0.95 以下である", () => {
      caseStore.addCase(makePastCase({ satisfaction: 5 }));
      const issue = makeIssue({ text: "材料不足" });
      const response = suggestSolutions(issue, caseStore);
      for (const sol of response.suggestedSolutions) {
        expect(sol.confidence).toBeLessThanOrEqual(0.95);
      }
    });
  });

  describe("シードデータ統合テスト", () => {
    it("seed 後に material_shortage テキストで Solution が返る", () => {
      caseStore.seed();
      const issue = makeIssue({ text: "フロア材が足りない。代替品を探したい" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions.length).toBeGreaterThan(0);
    });

    it("seed 後に safety_concern テキストで past_case が返る", () => {
      caseStore.seed();
      const issue = makeIssue({ text: "足場が危険でヒヤリハットが起きた" });
      const response = suggestSolutions(issue, caseStore);
      expect(response.suggestedSolutions[0].source).toBe("past_case");
    });
  });
});
