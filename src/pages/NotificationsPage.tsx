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
  const [updating, setUpdating] = useState<Set<string>>(new Set());

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

  const handleMarkSent = useCallback(async (id: string) => {
    setUpdating((prev) => new Set(prev).add(id));
    try {
      await notificationRepository.update(id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setUpdating((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [notificationRepository, loadData]);

  const handleMarkAllSent = useCallback(async () => {
    const pending = notifications.filter((n) => n.status === "pending");
    if (pending.length === 0) return;
    if (!confirm(`${pending.length}件の通知を全て送信済みにしますか？`)) return;
    const now = new Date().toISOString();
    try {
      for (const n of pending) {
        await notificationRepository.update(n.id, { status: "sent", sentAt: now, updatedAt: now });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "一括更新に失敗しました");
    }
  }, [notifications, notificationRepository, loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await notificationRepository.delete(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }, [notificationRepository, loadData]);

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-bold text-slate-900">通知一覧</h1>
        <div className="flex items-center gap-2">
          {notifications.some((n) => n.status === "pending") && (
            <button
              onClick={() => void handleMarkAllSent()}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
              style={{ minHeight: 36 }}
            >
              全て送信済みに
            </button>
          )}
          <button
            onClick={() => { setLoading(true); void loadData(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            style={{ minHeight: 36 }}
          >
            更新
          </button>
        </div>
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
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
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
              <div className="flex shrink-0 items-center gap-1">
                {n.status === "pending" && (
                  <button
                    onClick={() => void handleMarkSent(n.id)}
                    disabled={updating.has(n.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    aria-label="送信済みにする"
                  >
                    {updating.has(n.id) ? "..." : "送信済み"}
                  </button>
                )}
                <button
                  onClick={() => void handleDelete(n.id)}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  aria-label="削除"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
