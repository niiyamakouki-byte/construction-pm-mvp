/**
 * 変更指示ワークフロー — CoConstruct蒸留
 * 施主からの変更要求を申請→見積→承認→実施の4段階で管理する。
 * 承認時に unified-data-flow の予算エントリへ差額を反映する。
 */

import { syncEstimateToBudget, type BudgetCategoryEntry } from "./unified-data-flow.js";

export type ChangeRequestStatus =
  | "申請中"
  | "見積中"
  | "施主確認中"
  | "承認済"
  | "却下"
  | "実施済";

export type ChangeRequest = {
  id: string;
  projectId: string;
  requestedBy: string;
  description: string;
  impactDescription: string;
  originalEstimate: number;
  revisedEstimate: number;
  costDifference: number;
  status: ChangeRequestStatus;
  createdAt: string;
  approvedAt?: string;
};

export type ChangeRequestApprovalResult = {
  request: ChangeRequest;
  budgetEntries: BudgetCategoryEntry[];
};

// ── In-memory store ──────────────────────────────────────────────────────────

const changeRequests: ChangeRequest[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDiff(original: number, revised: number): number {
  return revised - original;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * 新規変更指示を登録する。costDifference は自動計算。
 */
export function createChangeRequest(
  params: Omit<ChangeRequest, "costDifference" | "status" | "createdAt">,
): ChangeRequest {
  const req: ChangeRequest = {
    ...params,
    costDifference: calcDiff(params.originalEstimate, params.revisedEstimate),
    status: "申請中",
    createdAt: new Date().toISOString(),
  };
  changeRequests.push({ ...req });
  return req;
}

/**
 * 全変更指示を取得する（projectId 指定時はフィルタリング）。
 */
export function getChangeRequests(projectId?: string): ChangeRequest[] {
  if (!projectId) return [...changeRequests];
  return changeRequests.filter((r) => r.projectId === projectId);
}

/**
 * IDで変更指示を取得する。
 */
export function getChangeRequestById(id: string): ChangeRequest | undefined {
  return changeRequests.find((r) => r.id === id);
}

/**
 * 変更指示を更新する。
 */
export function updateChangeRequest(
  id: string,
  updates: Partial<Omit<ChangeRequest, "id" | "projectId" | "createdAt">>,
): ChangeRequest {
  const idx = changeRequests.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`ChangeRequest ${id} not found`);

  const current = changeRequests[idx]!;
  const next: ChangeRequest = {
    ...current,
    ...updates,
    costDifference:
      updates.originalEstimate !== undefined || updates.revisedEstimate !== undefined
        ? calcDiff(
            updates.originalEstimate ?? current.originalEstimate,
            updates.revisedEstimate ?? current.revisedEstimate,
          )
        : current.costDifference,
  };
  changeRequests[idx] = next;
  return { ...next };
}

/**
 * テスト用: 全データをリセットする。
 */
export function clearChangeRequests(): void {
  changeRequests.length = 0;
}

// ── ステータス遷移 ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  申請中: ["見積中", "却下"],
  見積中: ["施主確認中", "却下"],
  施主確認中: ["承認済", "却下"],
  承認済: ["実施済"],
  却下: [],
  実施済: [],
};

/**
 * ステータスを遷移させる。
 * 承認済への遷移時は approvedAt を自動セットし、予算エントリを返す。
 */
export function transitionStatus(
  id: string,
  nextStatus: ChangeRequestStatus,
): { request: ChangeRequest; budgetEntries: BudgetCategoryEntry[] } {
  const idx = changeRequests.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`ChangeRequest ${id} not found`);

  const current = changeRequests[idx]!;
  const allowed = VALID_TRANSITIONS[current.status];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `ステータス遷移不可: ${current.status} → ${nextStatus}`,
    );
  }

  const next: ChangeRequest = {
    ...current,
    status: nextStatus,
    approvedAt: nextStatus === "承認済" ? new Date().toISOString() : current.approvedAt,
  };
  changeRequests[idx] = next;

  // 承認時: 差額を「変更指示コスト」として予算エントリに反映
  let budgetEntries: BudgetCategoryEntry[] = [];
  if (nextStatus === "承認済" && next.costDifference !== 0) {
    budgetEntries = syncEstimateToBudget([
      {
        name: `変更指示: ${next.description}`,
        quantity: 1,
        unitPrice: next.costDifference,
        amount: next.costDifference,
      },
    ]);
  }

  return { request: { ...next }, budgetEntries };
}

/**
 * 案件の変更指示コスト合計（承認済・実施済のみ）を返す。
 */
export function getApprovedCostTotal(projectId: string): number {
  return changeRequests
    .filter(
      (r) =>
        r.projectId === projectId &&
        (r.status === "承認済" || r.status === "実施済"),
    )
    .reduce((sum, r) => sum + r.costDifference, 0);
}
