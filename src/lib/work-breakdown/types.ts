/**
 * Work Breakdown Structure (WBS) 型定義
 * 3階層: 大項目 → 中項目 → 小項目
 */

/** 大項目 (例: 電気工事) */
export type WBSCategory = {
  id: string;
  name: string;
  /** デフォルト期間 (日) */
  defaultDays: number;
  groups: WBSGroup[];
};

/** 中項目 (例: 荒配線) */
export type WBSGroup = {
  id: string;
  categoryId: string;
  name: string;
  /** デフォルト期間 (日) */
  defaultDays: number;
  tasks: WBSTask[];
};

/** 小項目 (例: 天井内配線) */
export type WBSTask = {
  id: string;
  groupId: string;
  categoryId: string;
  name: string;
  /** デフォルト期間 (日) */
  defaultDays: number;
  costMasterCode?: string;
};

/** expandWBSToPhases の入力オプション */
export type WBSExpansionOptions = {
  projectId: string;
  projectStartDate: string;
  /** 展開する大項目名の集合 (undefined = 全項目) */
  selectedMajors?: Set<string>;
  includeWeekends?: boolean;
};
