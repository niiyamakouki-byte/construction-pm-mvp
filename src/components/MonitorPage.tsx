/**
 * MonitorPage — 現場モニタリング 1画面 (Sprint 9-B)
 *
 * 4分割グリッド (CSS Grid 2×2):
 *   左上: 簡易ガント (今日のタスク + 進捗バー + 遅延赤色強調)
 *   右上: 本日の日報 (最新3件 縦リスト)
 *   左下: チャット (最新5件 bubble)
 *   右下: 写真サムネ (最新6件 3列グリッド)
 *
 * v2-cozy: セージグリーン軸, 装飾最小, フォント階層で見せる, 絵文字は本文NG
 */

import { useEffect, useState } from "react";
import { MonitorRealtimeStore } from "../lib/monitor-tool/realtime-store.js";
import type {
  MonitorSnapshot,
  AlertItem,
  DailyReportEntry,
  PhotoEntry,
} from "../lib/monitor-tool/monitor-aggregator.js";
import type { ChatMessage } from "../domain/types.js";

// ── シングルトンストア ─────────────────────────────────────────────────────────
const monitorStore = new MonitorRealtimeStore();

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function AlertBadge({ alerts }: { alerts: AlertItem[] }) {
  const errors = alerts.filter((a) => a.severity === "error").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;
  const infos = alerts.filter((a) => a.severity === "info").length;

  if (alerts.length === 0) {
    return (
      <span className="text-xs text-slate-400 font-medium">
        アラートなし
      </span>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      {errors > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
          エラー {errors}
        </span>
      )}
      {warnings > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          警告 {warnings}
        </span>
      )}
      {infos > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
          {infos}
        </span>
      )}
    </div>
  );
}

// ─── 左上: 簡易ガント ──────────────────────────────────────────────────────────

function GanttPanel({ snapshot }: { snapshot: MonitorSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">本日の進捗データはまだありません</p>
      </div>
    );
  }

  const { ganttSummary } = snapshot;
  const total = ganttSummary.delayed + ganttSummary.onTrack + ganttSummary.ahead;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          全体進捗
        </span>
        <span className="text-sm font-bold text-sage-700">
          {ganttSummary.totalProgress}%
        </span>
      </div>

      {/* 総合進捗バー */}
      <div
        className="h-2 rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={ganttSummary.totalProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${ganttSummary.totalProgress}%` }}
        />
      </div>

      {/* ステータス内訳 */}
      {total > 0 ? (
        <div className="flex gap-3 text-xs">
          {ganttSummary.delayed > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              遅延 {ganttSummary.delayed}
            </span>
          )}
          {ganttSummary.onTrack > 0 && (
            <span className="flex items-center gap-1 text-slate-600">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              順調 {ganttSummary.onTrack}
            </span>
          )}
          {ganttSummary.ahead > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
              前倒 {ganttSummary.ahead}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">タスクなし</p>
      )}
    </div>
  );
}

// ─── 右上: 本日の日報 ─────────────────────────────────────────────────────────

function ReportsPanel({ reports }: { reports: DailyReportEntry[] }) {
  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">本日の日報はまだありません</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {reports.map((r) => (
        <li key={r.id} className="rounded-lg border border-slate-100 bg-white p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">{r.reportDate}</span>
            {r.weather && (
              <span className="text-xs text-slate-500 bg-slate-50 rounded px-1.5 py-0.5">
                {r.weather}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 line-clamp-2">{r.content}</p>
          {r.photoCount > 0 && (
            <p className="text-xs text-slate-400 mt-1">写真 {r.photoCount} 枚</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── 左下: チャット ───────────────────────────────────────────────────────────

function ChatPanel({ chats }: { chats: ChatMessage[] }) {
  if (chats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">メッセージはまだありません</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {chats.map((msg) => (
        <li key={msg.id} className="flex flex-col">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-slate-600">{msg.userName}</span>
            <span className="text-xs text-slate-400">
              {msg.timestamp.slice(11, 16)}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {msg.content}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── 右下: 写真サムネ ─────────────────────────────────────────────────────────

function PhotosPanel({ photos }: { photos: PhotoEntry[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">本日の写真はまだありません</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {photos.map((p) => (
        <div key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-slate-100">
          <img
            src={p.url}
            alt={p.caption ?? "現場写真"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

// ─── アラートリスト ───────────────────────────────────────────────────────────

function AlertList({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null;

  const colorMap: Record<AlertItem["severity"], string> = {
    error: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-100 bg-blue-50 text-blue-600",
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`rounded-md border px-3 py-2 text-xs font-medium ${colorMap[a.severity]}`}
        >
          {a.message}
        </li>
      ))}
    </ul>
  );
}

// ─── パネルラッパー ───────────────────────────────────────────────────────────

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 overflow-hidden">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {title}
      </h2>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

// ─── MonitorPage ──────────────────────────────────────────────────────────────

export function MonitorPage() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);

  useEffect(() => {
    // 購読開始
    const unsubscribe = monitorStore.subscribe((s) => {
      setSnapshot(s);
    });

    // ポーリング開始 (5秒)
    monitorStore.pullFromAPI(5000);

    return () => {
      unsubscribe();
      monitorStore.stop();
    };
  }, []);

  const todayStr = snapshot
    ? new Date(snapshot.today).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : new Date().toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });

  const alerts = snapshot?.alerts ?? [];

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">現場モニター</h1>
          <p className="text-xs text-slate-400">{todayStr}</p>
        </div>
        <AlertBadge alerts={alerts} />
      </header>

      {/* アラートリスト (有る時のみ表示) */}
      {alerts.length > 0 && <AlertList alerts={alerts} />}

      {/* 4分割グリッド */}
      <div
        className="grid grid-cols-2 gap-4 flex-1"
        style={{ minHeight: 0 }}
      >
        {/* 左上: ガント */}
        <PanelCard title="進捗サマリ">
          <GanttPanel snapshot={snapshot} />
        </PanelCard>

        {/* 右上: 日報 */}
        <PanelCard title="本日の日報">
          <ReportsPanel reports={snapshot?.todayReports ?? []} />
        </PanelCard>

        {/* 左下: チャット */}
        <PanelCard title="チャット">
          <ChatPanel chats={snapshot?.recentChats ?? []} />
        </PanelCard>

        {/* 右下: 写真 */}
        <PanelCard title="現場写真">
          <PhotosPanel photos={snapshot?.recentPhotos ?? []} />
        </PanelCard>
      </div>
    </div>
  );
}
