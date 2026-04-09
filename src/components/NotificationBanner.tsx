import { useCallback, useEffect, useMemo, useState } from "react";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { AppNotification } from "../lib/notifications.js";
import { buildNotifications, sortNotifications } from "../lib/notifications.js";
import { buildMockConstructionSiteForecasts, collectWeatherWarnings } from "../lib/weather.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";

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
        buildMockConstructionSiteForecasts(projects),
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
      setLoadError(error instanceof Error ? error.message : "通知の読み込みに失敗しました");
      setNotifications([]);
    }
  }, [costItemRepository, expenseRepository, projectRepository, taskRepository]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, refreshKey]);

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
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            通知一覧へ
          </button>
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
