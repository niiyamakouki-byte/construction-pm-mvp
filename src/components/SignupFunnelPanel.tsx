/**
 * SignupFunnelPanel — signup → trial 導線の離脱可視化（社内向け）
 * /funnel
 *
 * localStorage に記録したファネルイベントを集計し、各ステップの到達数・
 * 遷移率・離脱率をテーブル＋簡易バーで表示する。
 */
import { useState } from "react";
import { aggregateFunnel, getFunnelEvents, type FunnelStepStat } from "../lib/signup-funnel.js";

const SAGE = "#6B8E5A";

export function SignupFunnelPanel() {
  const [stats, setStats] = useState<FunnelStepStat[]>(() => aggregateFunnel(getFunnelEvents()));

  const refresh = () => setStats(aggregateFunnel(getFunnelEvents()));
  const topCount = stats[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">登録 → トライアル ファネル</h1>
          <p className="mt-1 text-sm text-slate-500">
            各ステップの到達数と離脱率を可視化します（この端末のローカル記録）。
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: SAGE }}
        >
          再読み込み
        </button>
      </div>

      {topCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          まだファネルイベントが記録されていません。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">ステップ</th>
                <th className="px-4 py-2.5 text-right font-medium">到達数</th>
                <th className="px-4 py-2.5 text-right font-medium">先頭比</th>
                <th className="px-4 py-2.5 text-right font-medium">離脱率</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.step} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{stat.label}</div>
                    {/* 先頭比の簡易バー */}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stat.conversionFromTop}%`, background: SAGE }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{stat.count}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {stat.conversionFromTop.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={stat.dropOff > 0 ? "text-red-600" : "text-slate-400"}>
                      {stat.dropOff > 0 ? `-${stat.dropOff.toFixed(0)}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
