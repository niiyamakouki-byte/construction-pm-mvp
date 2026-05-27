import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { AppNotification } from "../lib/notifications.js";
import { buildNotifications, sortNotifications } from "../lib/notifications.js";
import { fetchConstructionSiteForecasts, collectWeatherWarnings } from "../lib/weather.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";

const COLLAPSED_KEY = "gh-banner-collapsed";

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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const prevCountRef = useRef<number>(0);

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

      setNotifications(sortNotifications([...workflowNotifications, ...weatherWarnings]));
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

  // Auto-expand when new notifications arrive so users don't miss them
  useEffect(() => {
    if (notifications.length > prevCountRef.current && prevCountRef.current > 0) {
      setCollapsed(false);
      try { localStorage.removeItem(COLLAPSED_KEY); } catch { /* ignore */ }
    }
    prevCountRef.current = notifications.length;
  }, [notifications.length]);

  function handleCollapse() {
    setCollapsed(true);
    try { localStorage.setItem(COLLAPSED_KEY, "1"); } catch { /* ignore */ }
  }

  function handleExpand() {
    setCollapsed(false);
    try { localStorage.removeItem(COLLAPSED_KEY); } catch { /* ignore */ }
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

  if (notifications.length === 0) {
    return null;
  }

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
                重要通知 {notifications.length}件
              </span>
              <span className="text-[10px] text-slate-400">（タップで展開）</span>
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

  const visibleNotifications = notifications.slice(0, 4);

  return (
    <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#fffef8_0%,#ffffff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Alert Center
            </p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">
              重要通知 {notifications.length}件
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

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {visibleNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => navigate(notification.path)}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-transform hover:-translate-y-0.5 ${toneClassMap[notification.tone]}`}
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
          ))}
        </div>
      </div>
    </section>
  );
}
