/**
 * 現場AIチャットアシスタント — 型定義 (Sprint 12-A)
 *
 * 職人/監督が困りごとを投稿すると、過去事例DBから解決策候補3件を提示する。
 * 外部API/LLM不使用。純Regex + localStorage + rule_based のみ。
 */

// ── カテゴリ ─────────────────────────────────────────────────────────────────

export enum IssueCategory {
  material_shortage = "material_shortage",
  weather_delay = "weather_delay",
  tool_breakdown = "tool_breakdown",
  coordination = "coordination",
  safety_concern = "safety_concern",
  quality_issue = "quality_issue",
  client_request = "client_request",
  other = "other",
}

// ── 課題 ─────────────────────────────────────────────────────────────────────

export type Issue = {
  id: string;
  projectId: string;
  postedBy: string;
  text: string;
  category?: IssueCategory;
  postedAt: string; // ISO 8601
};

// ── 解決策 ───────────────────────────────────────────────────────────────────

export type Solution = {
  id: string;
  issueId: string;
  source: "past_case" | "rule_based" | "manual";
  summary: string;
  steps: string[];
  confidence: number; // 0-1
  referencedCaseIds: string[];
};

// ── 過去事例 ─────────────────────────────────────────────────────────────────

export type PastCase = {
  id: string;
  category: IssueCategory;
  problemSummary: string;
  solutionSummary: string;
  projectContext?: string;
  resolvedAt: string; // ISO 8601
  satisfaction: number; // 1-5
};

// ── アシスタントレスポンス ────────────────────────────────────────────────────

export type AssistantResponse = {
  issueId: string;
  suggestedSolutions: Solution[]; // top 3
  generatedAt: string; // ISO 8601
  fallbackMessage?: string;
};
