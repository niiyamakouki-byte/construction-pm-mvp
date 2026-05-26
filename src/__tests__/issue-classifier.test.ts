/**
 * issue-classifier.ts のテスト (Sprint 12-A)
 */
import { describe, it, expect } from "vitest";
import { classifyIssue } from "../lib/site-ai-assistant/issue-classifier.js";
import { IssueCategory } from "../lib/site-ai-assistant/types.js";

describe("classifyIssue", () => {
  // material_shortage
  it("「足りない」を material_shortage に分類する", () => {
    expect(classifyIssue("塗料が足りない")).toBe(IssueCategory.material_shortage);
  });
  it("「欠品」を material_shortage に分類する", () => {
    expect(classifyIssue("フロア材が欠品です")).toBe(IssueCategory.material_shortage);
  });
  it("「在庫」を material_shortage に分類する", () => {
    expect(classifyIssue("クロスの在庫がゼロです")).toBe(IssueCategory.material_shortage);
  });
  it("「不足」を material_shortage に分類する", () => {
    expect(classifyIssue("材料不足が発生しました")).toBe(IssueCategory.material_shortage);
  });

  // weather_delay
  it("「雨」を weather_delay に分類する", () => {
    expect(classifyIssue("今日は雨で作業できません")).toBe(IssueCategory.weather_delay);
  });
  it("「台風」を weather_delay に分類する", () => {
    expect(classifyIssue("台風接近で外壁塗装が中断")).toBe(IssueCategory.weather_delay);
  });
  it("「天候」を weather_delay に分類する", () => {
    expect(classifyIssue("天候不良で工程が遅れています")).toBe(IssueCategory.weather_delay);
  });

  // tool_breakdown
  it("「壊れた」を tool_breakdown に分類する", () => {
    expect(classifyIssue("コンプレッサーが壊れた")).toBe(IssueCategory.tool_breakdown);
  });
  it("「故障」を tool_breakdown に分類する", () => {
    expect(classifyIssue("レーザー墨出し器が故障しました")).toBe(IssueCategory.tool_breakdown);
  });
  it("「使えない」を tool_breakdown に分類する", () => {
    expect(classifyIssue("電動工具が使えない状態です")).toBe(IssueCategory.tool_breakdown);
  });

  // coordination
  it("「連絡」を coordination に分類する", () => {
    expect(classifyIssue("業者への連絡が取れていない")).toBe(IssueCategory.coordination);
  });
  it("「伝わってない」を coordination に分類する", () => {
    expect(classifyIssue("変更指示が伝わってない")).toBe(IssueCategory.coordination);
  });

  // safety_concern
  it("「危険」を safety_concern に分類する", () => {
    expect(classifyIssue("足場が危険な状態です")).toBe(IssueCategory.safety_concern);
  });
  it("「ヒヤリ」を safety_concern に分類する", () => {
    expect(classifyIssue("今日ヒヤリハットがありました")).toBe(IssueCategory.safety_concern);
  });
  it("「事故」を safety_concern に分類する", () => {
    expect(classifyIssue("事故が起きそうな状況です")).toBe(IssueCategory.safety_concern);
  });

  // quality_issue
  it("「不具合」を quality_issue に分類する", () => {
    expect(classifyIssue("塗装に不具合が発生")).toBe(IssueCategory.quality_issue);
  });
  it("「やり直し」を quality_issue に分類する", () => {
    expect(classifyIssue("フローリングのやり直しが必要")).toBe(IssueCategory.quality_issue);
  });

  // client_request
  it("「施主」を client_request に分類する", () => {
    expect(classifyIssue("施主から色変更の依頼が来た")).toBe(IssueCategory.client_request);
  });
  it("「お客様」を client_request に分類する", () => {
    expect(classifyIssue("お客様から追加工事の話がある")).toBe(IssueCategory.client_request);
  });
  it("「要望」を client_request に分類する", () => {
    expect(classifyIssue("施主の要望で設計変更")).toBe(IssueCategory.client_request);
  });

  // other (境界テスト)
  it("マッチするキーワードがない場合は other を返す", () => {
    expect(classifyIssue("今日は晴れました")).toBe(IssueCategory.other);
  });
  it("空文字列は other を返す", () => {
    expect(classifyIssue("")).toBe(IssueCategory.other);
  });
  it("関係のない英数字は other を返す", () => {
    expect(classifyIssue("ABC123 test input")).toBe(IssueCategory.other);
  });
});
