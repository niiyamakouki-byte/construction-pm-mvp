/**
 * ChangeRequestAdminPanel — PM 側の変更要望管理パネル (Sprint 71)
 *
 * - ownerStore から projectId 該当の ChangeRequest を一覧
 * - PM が概算金額 (estimated_cost) を入力
 * - status を 確認中 / 承認 / 却下 に遷移
 */

import { useEffect, useState } from "react";
import { ownerStore } from "../lib/owner-app/owner-store.js";
import type {
  ChangeRequest,
  ChangeRequestStatus,
} from "../lib/owner-app/types.js";

const statusLabel: Record<ChangeRequestStatus, string> = {
  pending: "申請中",
  reviewing: "確認中",
  approved: "承認済",
  rejected: "却下",
};

const statusBg: Record<ChangeRequestStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  reviewing: "bg-amber-100 text-amber-700",
  approved: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-700",
};

function formatTs(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function ChangeRequestAdminPanel({ projectId }: { projectId: string }) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => {
      const { requests: rs } = ownerStore.getSnapshot(projectId);
      setRequests(rs);
    };
    refresh();
    ownerStore.addEventListener("change", refresh);
    return () => ownerStore.removeEventListener("change", refresh);
  }, [projectId]);

  function handleUpdate(req: ChangeRequest, nextStatus: ChangeRequestStatus) {
    const raw = costInputs[req.id];
    const parsed = raw === undefined || raw === "" ? undefined : Number(raw);
    const estimated = Number.isFinite(parsed) && parsed !== undefined ? parsed : undefined;
    ownerStore.updateRequestStatus(req.id, nextStatus, estimated);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">変更要望</h3>
        <p className="text-xs text-slate-500">
          施主からの変更要望を確認し、概算金額の入力と承認/却下を行います。
        </p>
      </header>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">要望はまだありません。</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {req.title}
                  </p>
                  {req.body && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                      {req.body}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-slate-400">
                    申請日: {formatTs(req.ts)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusBg[req.status]}`}
                >
                  {statusLabel[req.status]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-600">
                  概算金額:
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={costInputs[req.id] ?? req.estimated_cost?.toString() ?? ""}
                    onChange={(e) =>
                      setCostInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    placeholder={req.estimated_cost?.toString() ?? "未入力"}
                    className="ml-2 w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                  <span className="ml-1 text-slate-400">円</span>
                </label>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(req, "reviewing")}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    確認中
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate(req, "approved")}
                    className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate(req, "rejected")}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    却下
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
