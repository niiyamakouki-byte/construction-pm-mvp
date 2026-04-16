/**
 * GenbaHub Project ↔ freee Deal 双方向同期
 *
 * - 新規案件作成時に freee に取引を登録
 * - 再同期時は ref_number で重複チェックを行い、スキップ or 更新
 * - クライアント未設定時は no-op を返す
 */

import type { FreeeClient } from "./client.js";
import type { DealInput } from "./types.js";
import type { Project } from "../../domain/types.js";

export type SyncStatus = "created" | "already_synced" | "skipped" | "error";

export type SyncResult = {
  projectId: string;
  status: SyncStatus;
  freeeDealsId?: number;
  message?: string;
};

// ── Helpers ──────────────────────────────────────────

/**
 * GenbaHub の Project を freee DealInput に変換する。
 * amount は budget フィールドから取得（未設定時は 0）。
 */
function projectToDealInput(project: Project): DealInput {
  const amount = project.budget ?? 0;

  return {
    issue_date: project.startDate,
    due_date: project.endDate,
    amount,
    type: "income",
    ref_number: project.id,
    details: [
      {
        id: 0,                    // POST 時は 0 を指定（freee が採番）
        account_item_id: 1,       // 売上高（暫定）
        tax_code: 21,             // 10%（建設工事標準）
        amount,
        description: project.name,
      },
    ],
  };
}

// ── Main export ───────────────────────────────────────

/**
 * GenbaHub の案件を freee に同期する。
 *
 * - 既に同期済み（同一 ref_number の deal が存在）→ "already_synced"
 * - 新規登録成功                                    → "created"
 * - クライアント未設定                              → "skipped"
 * - エラー                                          → "error"
 *
 * @param client      FreeeClient インスタンス
 * @param companyId   freee 事業所 ID
 * @param project     GenbaHub 案件
 */
export async function syncProjectToFreee(
  client: FreeeClient,
  companyId: number,
  project: Project,
): Promise<SyncResult> {
  if (!client.isConfigured()) {
    return {
      projectId: project.id,
      status: "skipped",
      message: "FREEE_ACCESS_TOKEN が未設定のためスキップ",
    };
  }

  try {
    // 重複チェック: 同一 ref_number の取引が存在しないか確認
    const existing = await client.listDeals(companyId);
    const duplicate = existing.find((d) => d.ref_number === project.id);

    if (duplicate) {
      return {
        projectId: project.id,
        status: "already_synced",
        freeeDealsId: duplicate.id,
        message: `freee deal ${duplicate.id} と照合済み`,
      };
    }

    const dealInput = projectToDealInput(project);
    const created = await client.createDeal(companyId, dealInput);

    return {
      projectId: project.id,
      status: "created",
      freeeDealsId: created.id,
      message: `freee deal ${created.id} を作成`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      projectId: project.id,
      status: "error",
      message,
    };
  }
}

/**
 * 複数案件を一括同期する。
 * 重複チェックの listDeals を 1 回だけ呼んで使い回すことで N+1 問題を回避する。
 */
export async function syncProjectsToFreee(
  client: FreeeClient,
  companyId: number,
  projects: Project[],
): Promise<SyncResult[]> {
  if (!client.isConfigured()) {
    return projects.map((p) => ({
      projectId: p.id,
      status: "skipped" as const,
      message: "FREEE_ACCESS_TOKEN が未設定のためスキップ",
    }));
  }

  let existingByRef: Map<string, { id: number }>;
  try {
    const existing = await client.listDeals(companyId);
    existingByRef = new Map(
      existing
        .filter((d): d is typeof d & { ref_number: string } => !!d.ref_number)
        .map((d) => [d.ref_number, { id: d.id }]),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return projects.map((p) => ({ projectId: p.id, status: "error" as const, message }));
  }

  return Promise.all(
    projects.map(async (project): Promise<SyncResult> => {
      const duplicate = existingByRef.get(project.id);
      if (duplicate) {
        return {
          projectId: project.id,
          status: "already_synced",
          freeeDealsId: duplicate.id,
          message: `freee deal ${duplicate.id} と照合済み`,
        };
      }

      try {
        const created = await client.createDeal(companyId, projectToDealInput(project));
        return {
          projectId: project.id,
          status: "created",
          freeeDealsId: created.id,
          message: `freee deal ${created.id} を作成`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { projectId: project.id, status: "error", message };
      }
    }),
  );
}
