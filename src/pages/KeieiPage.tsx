/**
 * /keiei — 経営タブ。残高・資金ランウェイ・未回収・今月の入出金・データ欠損を1画面で見せる。
 *
 * データは ~/laporta-keiei が既に計算した結果をそのまま出す（このページでは再計算しない）。
 * 実データは `pnpm dev` のローカルdevサーバ経由(/api/keiei/snapshot, vite.config.tsのmiddleware)
 * でのみ取得できる。本番(Vercel)にはこのMac上のファイルへのアクセス経路が無いため、その場合は
 * 「ローカル環境で見てください」という案内を出す（空白のまま見せない）。
 */
import { useEffect, useState } from "react";
import { Landmark, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../i18n/formatters/currency.js";

type RunwayEstimate = { months: number | null; exhaustedOn: string | null; assumption: string };
type ReceivableRow = { client: string; title: string; amount: number; dueDate: string; invoiceNumber: string };

type KeieiSnapshot =
  | {
      ok: true;
      asOf: string;
      bankBalance: number;
      runway: { worst: RunwayEstimate; best: RunwayEstimate; historical: RunwayEstimate | null } | null;
      receivables: { count: number; total: number; rows: ReceivableRow[] } | null;
      monthCashflow: { month: string; income: number; expense: number } | null;
      dataQuality: { unregisteredWalletTxns: number; asOf: string; note: string } | null;
      warnings: string[];
    }
  | { ok: false; reason: string };

type FetchState = "loading" | "loaded" | "unavailable";

function yen(n: number): string {
  return formatCurrency(n);
}

function runwayLabel(r: RunwayEstimate): string {
  if (r.months === null) return "残高プラス維持見込み";
  return `あと${r.months}ヶ月（${r.exhaustedOn}頃に枯渇想定）`;
}

function PredictedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800">
      予測
    </span>
  );
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function KeieiPage() {
  const [state, setState] = useState<FetchState>("loading");
  const [snapshot, setSnapshot] = useState<KeieiSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keiei/snapshot")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: KeieiSnapshot) => {
        if (cancelled) return;
        setSnapshot(data);
        setState("loaded");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header className="mb-1">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Landmark size={20} className="text-brand-700" aria-hidden="true" />
          経営
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {snapshot?.ok ? `${snapshot.asOf}時点` : "残高・資金ランウェイ・未回収を1画面で見る"}
        </p>
      </header>

      {state === "loading" && <p className="text-sm text-slate-500">読み込み中…</p>}

      {state === "unavailable" && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-base font-bold text-slate-900">経営データはローカル環境でのみ表示できます</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            この画面はこのMac上の経営見える化データ（~/laporta-keiei）を読みます。`pnpm dev`
            のローカル開発サーバで開いてください。
          </p>
        </div>
      )}

      {state === "loaded" && snapshot && !snapshot.ok && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-base font-bold text-slate-900">経営データがまだありません</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{snapshot.reason}</p>
        </div>
      )}

      {state === "loaded" && snapshot && snapshot.ok && (
        <>
          {snapshot.dataQuality && snapshot.dataQuality.unregisteredWalletTxns > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  データ欠損: 未登録取引 {snapshot.dataQuality.unregisteredWalletTxns.toLocaleString("ja-JP")}件
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {snapshot.dataQuality.asOf}時点。この画面の数字は不完全な集計です。{snapshot.dataQuality.note}
                </p>
              </div>
            </div>
          )}

          <Card title="残高（実績）">
            <p className="text-3xl font-bold text-slate-900">{yen(snapshot.bankBalance)}</p>
          </Card>

          <Card title="資金ランウェイ" badge={<PredictedBadge />}>
            {snapshot.runway ? (
              <div className="space-y-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 text-sm">
                <p>
                  <span className="font-semibold text-slate-700">支出のみ・悲観: </span>
                  {runwayLabel(snapshot.runway.worst)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">支出のみ・楽観: </span>
                  {runwayLabel(snapshot.runway.best)}
                </p>
                {snapshot.runway.historical && (
                  <p>
                    <span className="font-semibold text-slate-700">実績収益ペース反映: </span>
                    {runwayLabel(snapshot.runway.historical)}
                  </p>
                )}
                <p className="text-xs text-slate-500">前提: {snapshot.runway.worst.assumption}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">不明（未算出）</p>
            )}
          </Card>

          <Card title={`未回収${snapshot.receivables ? `（${snapshot.receivables.count}件）` : ""}`}>
            {snapshot.receivables ? (
              snapshot.receivables.count > 0 ? (
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-slate-900">{yen(snapshot.receivables.total)}</p>
                  <div className="overflow-x-auto">
                    <ul className="divide-y divide-slate-100 text-sm">
                      {snapshot.receivables.rows.map((r) => (
                        <li key={r.invoiceNumber} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{r.client}</p>
                            <p className="truncate text-xs text-slate-500">
                              {r.title} ・ 期日{r.dueDate}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold text-slate-900">{yen(r.amount)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">未回収なし</p>
              )
            ) : (
              <p className="text-sm text-slate-500">不明（受取請求データ未登録）</p>
            )}
          </Card>

          <Card title="今月の入出金（実績）">
            {snapshot.monthCashflow ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">入金</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                    {yen(snapshot.monthCashflow.income)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">出金</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                    {yen(snapshot.monthCashflow.expense)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">不明（データ未投入）</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
