/**
 * phase-template-master — Sprint 70
 * 13大項目103エントリの工程マスタから PhaseRecord[] を一括生成するヘルパー。
 *
 * データソース: src/lib/task-categories.ts (TASK_CATEGORIES)
 * 型出力: PhaseRecord (supabase-adapter/PhaseRepository)
 */

import { TASK_CATEGORIES } from "./task-categories.js";
import type { PhaseRecord } from "./supabase-adapter/PhaseRepository.js";

export type PhaseTemplateOptions = {
  projectId: string;
  organizationId?: string | null;
  /** 工程開始日 (YYYY-MM-DD)。省略時は今日 */
  startDate?: string;
};

/**
 * TASK_CATEGORIES の id[] を受け取り、対応する PhaseRecord[] を返す。
 *
 * - 大項目 (level 1) は id が一致する major を持つエントリの major 名から生成。
 *   selectedIds に含まれる TASK_CATEGORIES エントリの major を収集し、
 *   大項目ノードを parentId=null で作る。
 * - 中項目 (level 2) は parent = 大項目ノード。
 * - 小項目 (level 3) は parent = 中項目ノード。
 *
 * selectedIds が空のとき → 空配列を返す。
 * selectedIds に含まれない大項目は生成しない。
 */
export function applyPhaseTemplate(
  selectedIds: string[],
  opts: PhaseTemplateOptions,
): PhaseRecord[] {
  if (selectedIds.length === 0) return [];

  const { projectId, organizationId = null, startDate } = opts;
  const baseDate = startDate ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const selectedSet = new Set(selectedIds);

  // 選択エントリのみ
  const selected = TASK_CATEGORIES.filter((c) => selectedSet.has(c.id));
  if (selected.length === 0) return [];

  const result: PhaseRecord[] = [];

  // 大項目ノード: major 名でデデュープ
  const majorNodeMap = new Map<string, string>(); // majorName -> phaseId

  // 中項目ノード: `${major}__${middle}` -> phaseId
  const middleNodeMap = new Map<string, string>();

  let orderIndex = 0;

  function getMajorId(majorName: string): string {
    if (majorNodeMap.has(majorName)) return majorNodeMap.get(majorName)!;
    const id = crypto.randomUUID();
    majorNodeMap.set(majorName, id);
    result.push({
      id,
      projectId,
      organizationId,
      parentId: null,
      level: 1,
      name: majorName,
      orderIndex: orderIndex++,
      startDate: baseDate,
      endDate: null,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  function getMiddleId(majorName: string, middleName: string): string {
    const key = `${majorName}__${middleName}`;
    if (middleNodeMap.has(key)) return middleNodeMap.get(key)!;
    const parentId = getMajorId(majorName);
    const id = crypto.randomUUID();
    middleNodeMap.set(key, id);
    result.push({
      id,
      projectId,
      organizationId,
      parentId,
      level: 2,
      name: middleName,
      orderIndex: orderIndex++,
      startDate: baseDate,
      endDate: null,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  for (const cat of selected) {
    const parentId = getMiddleId(cat.major, cat.middle);

    if (cat.minor) {
      // 小項目 (level 3)
      result.push({
        id: crypto.randomUUID(),
        projectId,
        organizationId,
        parentId,
        level: 3,
        name: cat.minor,
        orderIndex: orderIndex++,
        startDate: baseDate,
        endDate: null,
        status: "planned",
        createdAt: now,
        updatedAt: now,
      });
    }
    // minor がない場合は中項目ノードで完結 (既に getMiddleId で生成済み)
  }

  return result;
}

/**
 * UI 向け: 全大項目名リストを返す (選択肢生成用)。
 */
export function getTemplateMajorNames(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of TASK_CATEGORIES) {
    if (!seen.has(cat.major)) {
      seen.add(cat.major);
      result.push(cat.major);
    }
  }
  return result;
}

/**
 * UI 向け: 指定大項目に属する TASK_CATEGORIES エントリの id[] を返す。
 */
export function getTemplateIdsByMajor(majorName: string): string[] {
  return TASK_CATEGORIES.filter((c) => c.major === majorName).map((c) => c.id);
}
