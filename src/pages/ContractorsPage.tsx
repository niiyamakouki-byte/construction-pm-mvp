import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contractor } from "../domain/types.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { getAllRoles, getRoleLabel } from "../lib/user-roles.js";

export function ContractorsPage() {
  const { organizationId } = useOrganizationContext();
  const contractorRepository = useMemo(
    () => createContractorRepository(() => organizationId),
    [organizationId],
  );

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allRoles = useMemo(() => getAllRoles(), []);

  // Form state
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [role, setRole] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await contractorRepository.findAll();
      setContractors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contractorRepository]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setLineId("");
    setSpecialty("");
    setRole("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      await contractorRepository.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        lineId: lineId.trim() || undefined,
        specialty: specialty.trim() || undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "業者の追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この業者を削除してもよろしいですか？")) return;
    try {
      await contractorRepository.delete(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "業者の削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="読み込み中">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">業者管理</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
        >
          <span className="text-sm leading-none">{showForm ? "−" : "+"}</span>
          業者を追加
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-800">新規業者登録</h2>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="会社名・業者名 *"
              required
              maxLength={200}
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="担当者名"
                maxLength={100}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="専門工種（例: 電気工事）"
                maxLength={100}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="電話番号"
                maxLength={20}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                maxLength={200}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="LINE ID"
              maxLength={100}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            >
              <option value="">権限ロール（任意）</option>
              {allRoles.map((r) => (
                <option key={r} value={r}>{getRoleLabel(r)}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "追加中..." : "追加"}
              </button>
            </div>
          </form>
        </div>
      )}

      {contractors.length > 0 && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="業者名・専門工種で検索..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          style={{ minHeight: 48 }}
        />
      )}

      {contractors.length === 0 && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-900">業者が登録されていません</p>
          <p className="mt-1 text-sm text-slate-500">「業者を追加」ボタンから協力会社を登録してください。</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {contractors.filter((c) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return c.name.toLowerCase().includes(q)
              || (c.specialty ?? "").toLowerCase().includes(q)
              || (c.contactPerson ?? "").toLowerCase().includes(q);
          }).map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {c.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {c.contactPerson && <span>担当: {c.contactPerson}</span>}
                  {c.specialty && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                      {c.specialty}
                    </span>
                  )}
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.lineId && <span>LINE: {c.lineId}</span>}
                </div>
              </div>
              <button
                onClick={() => void handleDelete(c.id)}
                className="shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label={`${c.name}を削除`}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
