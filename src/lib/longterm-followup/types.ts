/**
 * Longterm Followup — shared types.
 *
 * Sprint 19-A: 5年/10年フォローオート
 * 引渡日基準で自動カレンダー登録 (3ヶ月/1年/3年/5年/10年点検) + 施主アプリに劣化チェック診断を自動配信し、
 * リフォーム需要を先回りで掘り起こす。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type FollowupScheduleId = string & { readonly __brand: "FollowupScheduleId" };
export type FollowupCheckpointId = string & { readonly __brand: "FollowupCheckpointId" };
export type DiagnosisFormId = string & { readonly __brand: "DiagnosisFormId" };
export type RenovationLeadId = string & { readonly __brand: "RenovationLeadId" };

export function makeFollowupScheduleId(raw: string): FollowupScheduleId {
  return raw as FollowupScheduleId;
}

export function makeFollowupCheckpointId(raw: string): FollowupCheckpointId {
  return raw as FollowupCheckpointId;
}

export function makeDiagnosisFormId(raw: string): DiagnosisFormId {
  return raw as DiagnosisFormId;
}

export function makeRenovationLeadId(raw: string): RenovationLeadId {
  return raw as RenovationLeadId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type CheckpointKind =
  | "three_month"
  | "one_year"
  | "three_year"
  | "five_year"
  | "ten_year";

export type CheckpointStatus =
  | "scheduled"
  | "reminder_sent"
  | "diagnosis_sent"
  | "completed"
  | "skipped";

export type DegradationCategory =
  | "exterior_wall"
  | "roof"
  | "waterproofing"
  | "piping"
  | "hvac"
  | "fixtures"
  | "interior_finish"
  | "structural";

export type LeadPotential = "low" | "medium" | "high" | "urgent";

// ── Domain objects ─────────────────────────────────────────────────────────

export type FollowupSchedule = {
  id: FollowupScheduleId;
  /** 案件プロジェクトID */
  projectId: string;
  /** 施主オーナーID */
  ownerId: string;
  /** 引渡日 ISO 文字列 */
  handoverDate: string;
  /** 登録日 ISO 文字列 */
  registeredAt: string;
  /** チェックポイントID一覧 */
  checkpointIds: FollowupCheckpointId[];
  /** アクティブかどうか */
  isActive: boolean;
};

export type FollowupCheckpoint = {
  id: FollowupCheckpointId;
  scheduleId: FollowupScheduleId;
  kind: CheckpointKind;
  status: CheckpointStatus;
  /** 予定日 ISO 文字列 */
  scheduledDate: string;
  /** リマインダー送信予定日 ISO 文字列 (予定日の14日前) */
  reminderDate: string;
  /** 診断フォーム送信予定日 ISO 文字列 (予定日の3日前) */
  diagnosisDate: string;
  /** 診断フォームID (送信後に設定) */
  diagnosisFormId?: DiagnosisFormId;
  /** リフォームリードID (診断後に設定) */
  renovationLeadId?: RenovationLeadId;
  /** 完了日 ISO 文字列 */
  completedAt?: string;
};

export type DiagnosisQuestion = {
  id: string;
  /** 質問テキスト (日本語) */
  questionJa: string;
  /** 劣化カテゴリ */
  category: DegradationCategory;
  /** 回答形式: 1-5 スコア */
  scale: 1 | 5;
};

export type DiagnosisForm = {
  id: DiagnosisFormId;
  checkpointId: FollowupCheckpointId;
  kind: CheckpointKind;
  questions: DiagnosisQuestion[];
  createdAt: string;
};

export type DiagnosisResponse = {
  formId: DiagnosisFormId;
  checkpointId: FollowupCheckpointId;
  /** questionId → スコア (1=良好, 5=要対処) */
  answers: Record<string, number>;
  submittedAt: string;
};

export type RenovationLead = {
  id: RenovationLeadId;
  scheduleId: FollowupScheduleId;
  checkpointId: FollowupCheckpointId;
  projectId: string;
  ownerId: string;
  potential: LeadPotential;
  overallScore: number;
  /** カテゴリ別劣化スコア (0-100) */
  categoryScores: Record<DegradationCategory, number>;
  /** 緊急カテゴリ一覧 */
  urgentCategories: DegradationCategory[];
  /** 推奨工種リスト */
  recommendedWorkTypes: string[];
  /** 概算金額レンジ下限 (JPY) */
  estimatedMinJpy: number;
  /** 概算金額レンジ上限 (JPY) */
  estimatedMaxJpy: number;
  /** 提案開始タイミング (日本語) */
  proposalTimingJa: string;
  createdAt: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const CHECKPOINT_KIND_LABELS: Record<CheckpointKind, string> = {
  three_month: "3ヶ月点検",
  one_year: "1年点検",
  three_year: "3年点検",
  five_year: "5年点検",
  ten_year: "10年点検",
};

export const CHECKPOINT_STATUS_LABELS: Record<CheckpointStatus, string> = {
  scheduled: "予定",
  reminder_sent: "リマインダー送信済み",
  diagnosis_sent: "診断送信済み",
  completed: "完了",
  skipped: "スキップ",
};

export const DEGRADATION_CATEGORY_LABELS: Record<DegradationCategory, string> = {
  exterior_wall: "外壁",
  roof: "屋根",
  waterproofing: "防水",
  piping: "配管",
  hvac: "空調・換気",
  fixtures: "建具・設備",
  interior_finish: "内装仕上げ",
  structural: "構造",
};

export const LEAD_POTENTIAL_LABELS: Record<LeadPotential, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "緊急",
};
