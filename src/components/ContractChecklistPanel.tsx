import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContractChecklistItem } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

// ── デフォルトチェック項目 ────────────────────────────────
export const DEFAULT_CONTRACT_ITEMS: { key: string; label: string }[] = [
  { key: "contract_signed",      label: "請負契約書の取り交わし" },
  { key: "order_docs_received",  label: "注文書・注文請書の受領" },
  { key: "payment_terms_clear",  label: "契約金額と支払条件の明記" },
  { key: "defect_warranty",      label: "瑕疵担保（契約不適合）条項の確認" },
  { key: "schedule_penalty",     label: "工期・遅延時の取り決め" },
  { key: "change_order_rule",    label: "追加変更工事の精算ルール" },
  { key: "insurance_confirmed",  label: "保険（労災・賠償）の確認" },
  { key: "license_verified",     label: "建設業許可の確認" },
  { key: "neighbor_greeted",     label: "近隣挨拶・養生範囲の合意" },
];

type Props = { projectId: string };

export function ContractChecklistPanel({ projectId }: Props) {
  const { organizationId } = useOrganizationContext();
  const repo = useMemo(
    () => createAppRepository<ContractChecklistItem>("contract_checklists", () => organizationId),
    [organizationId],
  );

  const [items, setItems] = useState<ContractChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await repo.findAll();
      setItems(all.filter((i) => i.projectId === projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みエラー");
    } finally {
      setLoading(false);
    }
  }, [repo, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkedKeys = useMemo(() => new Set(items.filter((i) => i.checked).map((i) => i.itemKey)), [items]);

  const handleToggle = async (key: string) => {
    const existing = items.find((i) => i.itemKey === key);
    try {
      if (existing) {
        await repo.update(existing.id, { checked: !existing.checked });
      } else {
        const now = new Date().toISOString();
        await repo.create({
          id: crypto.randomUUID(),
          projectId,
          itemKey: key,
          checked: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存エラー");
    }
  };

  const checkedCount = checkedKeys.size;
  const total = DEFAULT_CONTRACT_ITEMS.length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#5a8a5a]/30 border-t-[#5a8a5a]" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <section aria-label="契約チェックリスト" className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {/* カウンタ */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          {checkedCount}/{total} 完了
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            checkedCount === total
              ? "bg-[#5a8a5a]/10 text-[#3a6a3a]"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {checkedCount === total ? "完了" : "確認中"}
        </span>
      </div>

      {/* 進捗バー */}
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#5a8a5a] transition-all duration-300"
          style={{ width: `${total > 0 ? Math.round((checkedCount / total) * 100) : 0}%` }}
          aria-hidden="true"
        />
      </div>

      {/* チェック項目 */}
      <ul className="space-y-1" role="list">
        {DEFAULT_CONTRACT_ITEMS.map(({ key, label }) => {
          const checked = checkedKeys.has(key);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => void handleToggle(key)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#5a8a5a]"
                  aria-label={label}
                />
                <span className={`text-sm ${checked ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
