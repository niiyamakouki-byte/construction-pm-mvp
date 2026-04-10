/**
 * Project flow management for interior construction workflow.
 * 9-stage pipeline: 依頼→現調→仕様確認→品番選定→図面作成→金額確定→契約→着工→完工
 */

export const ProjectStage = {
  inquiry: "inquiry",         // 依頼
  siteVisit: "siteVisit",     // 現調
  specification: "specification", // 仕様確認
  productSelect: "productSelect", // 品番選定
  drawing: "drawing",         // 図面作成
  pricing: "pricing",         // 金額確定
  contract: "contract",       // 契約
  construction: "construction", // 着工
  completed: "completed",     // 完工
} as const;

export type ProjectStage = (typeof ProjectStage)[keyof typeof ProjectStage];

export const STAGE_ORDER: ProjectStage[] = [
  ProjectStage.inquiry,
  ProjectStage.siteVisit,
  ProjectStage.specification,
  ProjectStage.productSelect,
  ProjectStage.drawing,
  ProjectStage.pricing,
  ProjectStage.contract,
  ProjectStage.construction,
  ProjectStage.completed,
];

const STAGE_LABELS: Record<ProjectStage, string> = {
  inquiry: "依頼",
  siteVisit: "現調",
  specification: "仕様確認",
  productSelect: "品番選定",
  drawing: "図面作成",
  pricing: "金額確定",
  contract: "契約",
  construction: "着工",
  completed: "完工",
};

const STAGE_DESCRIPTIONS: Record<ProjectStage, string> = {
  inquiry: "お客様からの依頼を受け付け、概要を把握",
  siteVisit: "現場を訪問し、現状を確認・採寸",
  specification: "使用する材料・工法の仕様を決定",
  productSelect: "具体的な品番・型番を選定",
  drawing: "施工図面・詳細図を作成",
  pricing: "見積もり作成・金額交渉",
  contract: "契約締結・発注準備",
  construction: "施工開始",
  completed: "施工完了・引き渡し",
};

export type StageStatus = "notStarted" | "inProgress" | "completed" | "blocked";

export type ChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
};

export type StageProgress = {
  stage: ProjectStage;
  status: StageStatus;
  checklist: ChecklistItem[];
};

const DEFAULT_CHECKLISTS: Record<ProjectStage, ChecklistItem[]> = {
  inquiry: [
    { id: "inq_1", label: "顧客情報の登録", required: true, completed: false },
    { id: "inq_2", label: "依頼内容のヒアリング", required: true, completed: false },
    { id: "inq_3", label: "概算予算の確認", required: false, completed: false },
    { id: "inq_4", label: "希望工期の確認", required: false, completed: false },
    { id: "inq_5", label: "現調日程の調整", required: true, completed: false },
  ],
  siteVisit: [
    { id: "sv_1", label: "現場写真の撮影", required: true, completed: false },
    { id: "sv_2", label: "採寸・寸法の記録", required: true, completed: false },
    { id: "sv_3", label: "既存設備の確認", required: true, completed: false },
    { id: "sv_4", label: "搬入経路の確認", required: false, completed: false },
    { id: "sv_5", label: "現調報告書の作成", required: true, completed: false },
  ],
  specification: [
    { id: "spec_1", label: "仕様案の作成", required: true, completed: false },
    { id: "spec_2", label: "顧客への仕様説明", required: false, completed: false },
    { id: "spec_3", label: "仕様の承認取得", required: true, completed: false },
    { id: "spec_4", label: "仕様書の確定", required: true, completed: false },
  ],
  productSelect: [
    { id: "prod_1", label: "品番リストの作成", required: true, completed: false },
    { id: "prod_2", label: "在庫・納期の確認", required: true, completed: false },
    { id: "prod_3", label: "代替品の検討", required: false, completed: false },
    { id: "prod_4", label: "品番の確定", required: true, completed: false },
    { id: "prod_5", label: "拾い出しリストの完成", required: true, completed: false },
  ],
  drawing: [
    { id: "drw_1", label: "施工図の作成", required: true, completed: false },
    { id: "drw_2", label: "詳細図の作成", required: false, completed: false },
    { id: "drw_3", label: "図面チェック", required: true, completed: false },
    { id: "drw_4", label: "顧客への図面説明", required: false, completed: false },
    { id: "drw_5", label: "図面の承認", required: true, completed: false },
  ],
  pricing: [
    { id: "prc_1", label: "材料費の算出", required: true, completed: false },
    { id: "prc_2", label: "工賃の算出", required: true, completed: false },
    { id: "prc_3", label: "見積書の作成", required: true, completed: false },
    { id: "prc_4", label: "見積書の提出", required: true, completed: false },
    { id: "prc_5", label: "金額交渉・調整", required: false, completed: false },
    { id: "prc_6", label: "最終金額の合意", required: true, completed: false },
  ],
  contract: [
    { id: "cnt_1", label: "契約書の作成", required: true, completed: false },
    { id: "cnt_2", label: "契約内容の確認", required: true, completed: false },
    { id: "cnt_3", label: "契約書の締結", required: true, completed: false },
    { id: "cnt_4", label: "着手金の入金確認", required: false, completed: false },
    { id: "cnt_5", label: "材料の発注開始", required: true, completed: false },
    { id: "cnt_6", label: "工程表の作成", required: true, completed: false },
  ],
  construction: [
    { id: "cst_1", label: "材料の納品確認", required: true, completed: false },
    { id: "cst_2", label: "着工前確認", required: true, completed: false },
    { id: "cst_3", label: "施工の実施", required: true, completed: false },
    { id: "cst_4", label: "中間検査", required: false, completed: false },
    { id: "cst_5", label: "完了検査", required: true, completed: false },
    { id: "cst_6", label: "手直し対応", required: false, completed: false },
  ],
  completed: [
    { id: "cmp_1", label: "完了報告書の作成", required: true, completed: false },
    { id: "cmp_2", label: "顧客への引き渡し", required: true, completed: false },
    { id: "cmp_3", label: "最終請求書の発行", required: true, completed: false },
    { id: "cmp_4", label: "入金確認", required: true, completed: false },
    { id: "cmp_5", label: "アフターフォロー登録", required: false, completed: false },
  ],
};

export function getStageLabel(stage: ProjectStage): string {
  return STAGE_LABELS[stage];
}

export function getStageDescription(stage: ProjectStage): string {
  return STAGE_DESCRIPTIONS[stage];
}

export function getDefaultChecklist(stage: ProjectStage): ChecklistItem[] {
  return DEFAULT_CHECKLISTS[stage].map((item) => ({ ...item }));
}

export function getStageIndex(stage: ProjectStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function calculateStageCompletion(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const completed = checklist.filter((item) => item.completed).length;
  return completed / checklist.length;
}

export function canAdvanceStage(checklist: ChecklistItem[]): boolean {
  const requiredItems = checklist.filter((item) => item.required);
  return requiredItems.every((item) => item.completed);
}

export function calculateOverallProgress(stageProgresses: StageProgress[]): number {
  const completedStages = stageProgresses.filter(
    (p) => p.status === "completed",
  ).length;
  return completedStages / STAGE_ORDER.length;
}

export function createInitialStageProgresses(): StageProgress[] {
  return STAGE_ORDER.map((stage, index) => ({
    stage,
    status: index === 0 ? "inProgress" : "notStarted",
    checklist: getDefaultChecklist(stage),
  }));
}
