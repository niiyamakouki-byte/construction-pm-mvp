import { useCallback, useEffect, useMemo, useState } from "react";
import type { Notification, NotificationStatus } from "../domain/types.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

const statusLabel: Record<NotificationStatus, string> = {
  pending: "未送信",
  sent: "送信済",
  failed: "失敗",
};

const statusColor: Record<NotificationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const typeLabel: Record<Notification["type"], string> = {
  schedule_confirmed: "工程確定",
  schedule_changed: "工程変更",
  reminder: "リマインダー",
  alert: "アラート",
};

export function NotificationsPage() {
  const { organizationId } = useOrganizationContext();
  const notificationRepository = useMemo(
    () => createNotificationRepository(() => organizationId),
    [organizationId],
  );

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationRepository.findAll();
      // Sort newest first
      const sorted = [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotifications(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [notificationRepository]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        <h1 className="text-lg font-bold text-slate-900">通知一覧</h1>
        <button
          onClick={() => { setLoading(true); void loadData(); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          更新
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {/* Status summary */}
      {notifications.length > 0 && (
        <div className="flex gap-3">
          {(["pending", "sent", "failed"] as NotificationStatus[]).map((s) => {
            const count = notifications.filter((n) => n.status === s).length;
            return (
              <div key={s} className="flex-1 rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-slate-900 tabular-nums">{count}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[s]}`}>
                  {statusLabel[s]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-900">通知はありません</p>
          <p className="mt-1 text-sm text-slate-500">
            タスクの工程が確定・変更されると通知レコードが作成されます。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[n.status]}`}>
                    {statusLabel[n.status]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {typeLabel[n.type]}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {new Date(n.createdAt).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-800">{n.message}</p>
                {n.scheduledAt && (
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    送信予定: {new Date(n.scheduledAt).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
