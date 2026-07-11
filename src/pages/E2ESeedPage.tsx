/** Provenance: laporta-beads-d4vpz; creator: Codex; implementation commit: pending. */
import { useEffect, useState } from "react";
import { navigate } from "../hooks/useHashRouter.js";
import { isE2ESeedAllowed, seedE2EDemoData, type E2ESeedResult } from "../lib/e2e-seed.js";

export function E2ESeedPage() {
  const allowed = isE2ESeedAllowed();
  const [result, setResult] = useState<E2ESeedResult | null>(null);

  useEffect(() => {
    if (!allowed) return;
    window.__E2E_BYPASS_AUTH__ = true;
    const seeded = seedE2EDemoData(window.localStorage);
    setResult(seeded);
    const timer = window.setTimeout(() => navigate("/today"), 300);
    return () => window.clearTimeout(timer);
  }, [allowed]);

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm" role="alert">
          <h1 className="text-lg font-bold text-slate-900">E2Eシードは無効です</h1>
          <p className="mt-2 text-sm text-slate-600">このURLはローカル開発環境とVercel Previewでのみ利用できます。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6" role="status">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        <h1 className="mt-4 text-lg font-bold text-slate-900">E2Eデモデータを準備中</h1>
        <p className="mt-2 text-sm text-slate-600">
          {result ? `案件1件・工程${result.tasks}件・写真${result.photos}件・見積${result.estimates}件を投入しました。` : "データを投入しています…"}
        </p>
      </div>
    </main>
  );
}
