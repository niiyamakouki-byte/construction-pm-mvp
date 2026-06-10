import { useCallback, useEffect, useMemo, useState } from "react";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { AppNotification, AppNotificationType } from "../lib/notifications.js";
import { buildNotifications, isStaleOverdue, sortNotifications, STALE_OVERDUE_DAYS } from "../lib/notifications.js";
import {
  getNextSnoozeUntil,
  isDismissed,
  loadDismissals,
  pruneDismissals,
  saveDismissals,
  type NotificationDismissalMap,
} from "../lib/notification-dismissals.js";
import { fetchConstructionSiteForecasts, collectWeatherWarnings } from "../lib/weather.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";

const COLLAPSED_KEY = "gh-banner-collapsed";
const CRITICAL_TONES = new Set<AppNotification["tone"]>(["red"]);

type NotificationBannerProps = {
  refreshKey?: string;
};

const toneClassMap = {
  red: "border-red-200 bg-red-50 text-red-900",
  yellow: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  orange: "border-orange-200 bg-orange-50 text-orange-900",
} as const;

const badgeClassMap = {
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
  blue: "bg-sky-100 text-sky-700",
  orange: "bg-orange-100 text-orange-700",
} as const;

const iconMap = {
  overdue_task: "⚠",
  upcoming_deadline: "⏳",
  weather_warning: "☔",
  cost_overrun: "¥",
  procurement_alert: "📦",
} as const;

const groupLabelMap: Record<AppNotificationType, string> = {
  overdue_task: "期限超過タスク",
  upcoming_deadline: "3日以内の期限",
  cost_overrun: "予算超過",
  procurement_alert: "調達アラート",
  weather_warning: "天候注意",
};

// 種別ごとの表示順（toneと合わせて視覚優先度を維持）
const GROUP_ORDER: AppNotificationType[] = [
  "overdue_task",
  "cost_overrun",
  "procurement_alert",
  "upcoming_deadline",
  "weather_warning",
];

type NotificationGroup = {
  type: AppNotificationType;
  fresh: AppNotification[];
  stale: AppNotification[];
};

function groupNotifications(notifications: AppNotification[]): NotificationGroup[] {
  const byType = new Map<AppNotificationType, NotificationGroup>();
  for (const notification of notifications) {
    const existing = byType.get(notification.type) ?? {
      type: notification.type,
      fresh: [],
      stale: [],
    };
    if (isStaleOverdue(notification)) {
      existing.stale.push(notification);
    } else {
      existing.fresh.push(notification);
    }
    byType.set(notification.type, existing);
  }
  return GROUP_ORDER
    .map((type) => byType.get(type))
    .filter((group): group is NotificationGroup => Boolean(group));
}

export function NotificationBanner({ refreshKey }: NotificationBannerProps) {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const costItemRepository = useMemo(
    () => createCostItemRepository(() => organizationId),
    [organizationId],
  );
  const expenseRepository = useMemo(
    () => createAppRepository<Expense>("expenses", () => organizationId),
    [organizationId],
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<AppNotificationType>>(() => new Set());
  const [expandedStaleGroups, setExpandedStaleGroups] = useState<Set<AppNotificationType>>(() => new Set());
  const [dismissals, setDismissals] = useState<NotificationDismissalMap>(() => loadDismissals());
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const loadNotifications = useCallback(async () => {
    try {
      setLoadError(null);
      const [projects, tasks, costItems, expenses] = await Promise.all([
        projectRepository.findAll(),
        taskRepository.findAll(),
        costItemRepository.findAll(),
        expenseRepository.findAll(),
      ]) as [Project[], Task[], CostItem[], Expense[]];

      const workflowNotifications = buildNotifications({
        projects,
        tasks,
        costItems,
        expenses,
      });

      const weatherWarnings = collectWeatherWarnings(
        await fetchConstructionSiteForecasts(projects),
        2,
      ).map((warning) => ({
        id: `weather:${warning.siteId}:${warning.day.dt}`,
        type: "weather_warning" as const,
        tone: "blue" as const,
        title: "天候注意",
        message: `${warning.siteName} ${warning.dateLabel}: ${warning.risk.reasons.join(" / ")}`,
        path: "/weather",
        projectId: warning.projectId,
        sortDate: String(warning.day.dt),
      }));

      const merged = sortNotifications([...workflowNotifications, ...weatherWarnings]);
      setNotifications(merged);
      // 現存しない id を localStorage から掃除
      setDismissals((prev) => {
        const liveIds = new Set(merged.map((n) => n.id));
        const pruned = pruneDismissals(prev, liveIds);
        // 中身が変わったときだけ書き戻す
        if (Object.keys(pruned).length !== Object.keys(prev).length) {
          saveDismissals(pruned);
          return pruned;
        }
        return prev;
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      // Suppress Supabase/network errors from UI - not actionable for the user
      const isSupabaseError = msg.toLowerCase().includes("supabase") || msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("jwt");
      setLoadError(isSupabaseError ? null : (msg || "通知の読み込みに失敗しました"));
      setNotifications([]);
    }
  }, [costItemRepository, expenseRepository, projectRepository, taskRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 通知データの取得・更新トリガー
    void loadNotifications();
  }, [loadNotifications, refreshKey]);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !isDismissed(dismissals[n.id])),
    [notifications, dismissals],
  );

  // Keep global notices compact unless a critical item needs immediate attention.
  useEffect(() => {
    const hasCriticalNotification = visibleNotifications.some((notification) => CRITICAL_TONES.has(notification.tone));
    try {
      const storedPreference = localStorage.getItem(COLLAPSED_KEY);
      if (hasCriticalNotification && storedPreference !== "1") {
        setCollapsed(false);
      } else if (!hasCriticalNotification && storedPreference !== "0") {
        setCollapsed(true);
      }
    } catch {
      setCollapsed(!hasCriticalNotification);
    }
  }, [visibleNotifications]);

  function handleCollapse() {
    setCollapsed(true);
    try { localStorage.setItem(COLLAPSED_KEY, "1"); } catch { /* ignore */ }
  }

  function handleExpand() {
    setCollapsed(false);
    try { localStorage.setItem(COLLAPSED_KEY, "0"); } catch { /* ignore */ }
  }

  if (loadError) {
    return (
      <section className="border-b border-red-200 bg-red-50">
        <div className="mx-auto max-w-6xl px-4 py-2 text-sm text-red-700" role="alert">
          {loadError}
        </div>
      </section>
    );
  }

  if (visibleNotifications.length === 0) {
    return null;
  }

  const staleCount = visibleNotifications.filter(isStaleOverdue).length;
  const freshCount = visibleNotifications.length - staleCount;
  const staleHint = staleCount > 0 ? `+${staleCount}件は${STALE_OVERDUE_DAYS}日以上前` : null;

  if (collapsed) {
    return (
      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#fffef8_0%,#ffffff_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExpand}
              className="flex flex-1 items-center gap-2 text-left"
              aria-label="通知を展開"
            >
              <span className="text-sm" aria-hidden="true">⚠</span>
              <span className="text-xs font-semibold text-slate-700">
                重要通知 {freshCount}件
              </span>
              {staleHint && (
                <span className="text-[10px] text-slate-400">{staleHint}</span>
              )}
              <span className="text-[10px] text-slate-400">（タップで展開）</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              一覧
            </button>
            <button
              type="button"
              onClick={handleExpand}
              aria-label="通知を展開"
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const groups = groupNotifications(visibleNotifications);

  function toggleGroup(type: AppNotificationType) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function toggleStaleGroup(type: AppNotificationType) {
    setExpandedStaleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function dismissNotification(id: string) {
    setDismissals((prev) => {
      const next: NotificationDismissalMap = { ...prev, [id]: { type: "read" } };
      saveDismissals(next);
      return next;
    });
  }

  function snoozeNotification(id: string) {
    setDismissals((prev) => {
      const next: NotificationDismissalMap = {
        ...prev,
        [id]: { type: "snooze", until: getNextSnoozeUntil() },
      };
      saveDismissals(next);
      return next;
    });
  }

  function renderNotificationButton(notification: AppNotification) {
    return (
      <div
        key={notification.id}
        className={`flex items-start gap-2 rounded-2xl border px-3 py-2 ${toneClassMap[notification.tone]}`}
      >
        <button
          type="button"
          onClick={() => navigate(notification.path)}
          className="flex flex-1 items-start gap-3 text-left transition-transform hover:-translate-y-0.5"
        >
          <span className="mt-0.5 text-lg" aria-hidden="true">
            {iconMap[notification.type]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClassMap[notification.tone]}`}>
                {notification.title}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium leading-5">
              {notification.message}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={() => snoozeNotification(notification.id)}
            aria-label="後で（明日の朝まで非表示）"
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-white/70 px-2 text-[11px] font-semibold text-slate-600 hover:bg-white"
          >
            後で
          </button>
          <button
            type="button"
            onClick={() => dismissNotification(notification.id)}
            aria-label="既読にして非表示"
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-white/70 text-base font-semibold text-slate-500 hover:bg-white hover:text-slate-700"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#fffef8_0%,#ffffff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Alert Center
            </p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">
              <span>重要通知 {freshCount}件</span>
              {staleHint && (
                <span className="ml-1.5 text-[11px] font-normal text-slate-400">{staleHint}</span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              通知一覧へ
            </button>
            <button
              type="button"
              onClick={handleCollapse}
              aria-label="通知を折りたたむ"
              className="rounded-full border border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {groups.map((group) => {
            const groupTotal = group.fresh.length + group.stale.length;
            // 1件のみのグループはヘッダーなしで直接表示
            if (groupTotal === 1) {
              const only = group.fresh[0] ?? group.stale[0];
              return (
                <div key={group.type} className="grid gap-2 md:grid-cols-2">
                  {renderNotificationButton(only)}
                </div>
              );
            }
            const isOpen = expandedGroups.has(group.type);
            const staleOpen = expandedStaleGroups.has(group.type);
            const groupLabel = groupLabelMap[group.type];
            return (
              <div key={group.type} className="rounded-2xl border border-slate-200 bg-white/60">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.type)}
                  aria-expanded={isOpen}
                  aria-controls={`notif-group-${group.type}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">{iconMap[group.type]}</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {groupLabel} {groupTotal}件
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && (
                  <div id={`notif-group-${group.type}`} className="grid gap-2 px-3 pb-3 md:grid-cols-2">
                    {group.fresh.map(renderNotificationButton)}
                    {group.stale.length > 0 && (
                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={() => toggleStaleGroup(group.type)}
                          aria-expanded={staleOpen}
                          aria-controls={`notif-stale-${group.type}`}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <span>{STALE_OVERDUE_DAYS}日以上前の超過 {group.stale.length}件</span>
                          <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 text-slate-400 transition-transform ${staleOpen ? "rotate-180" : ""}`} aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {staleOpen && (
                          <div id={`notif-stale-${group.type}`} className="mt-2 grid gap-2 md:grid-cols-2">
                            {group.stale.map(renderNotificationButton)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
