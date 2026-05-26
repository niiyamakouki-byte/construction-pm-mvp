/**
 * monitor-aggregator — MonitorSnapshot の集計ロジック
 *
 * 既存型 (Task, DailyReport, ChatMessage, Photo) を再利用し、
 * 1画面 Monitor 表示に必要なデータを集約する。
 * React / DOM 依存なし。
 */

import type { Task, DailyReport, ChatMessage, Photo } from "../../domain/types.js";

// ── 出力型 ───────────────────────────────────────────────────────────────────

export type GanttSummary = {
  delayed: number;
  onTrack: number;
  ahead: number;
  totalProgress: number; // 0-100 平均進捗率
};

export type DailyReportEntry = {
  id: string;
  projectId: string;
  reportDate: string;
  weather: string | undefined;
  content: string;
  photoCount: number;
  authorId: string | undefined;
};

export type PhotoEntry = {
  id: string;
  projectId: string;
  url: string;
  caption: string | undefined;
  takenAt: string | undefined;
};

export type AlertSeverity = "error" | "warning" | "info";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  message: string;
};

export type MonitorSnapshot = {
  today: Date;
  ganttSummary: GanttSummary;
  todayReports: DailyReportEntry[];
  recentChats: ChatMessage[];
  recentPhotos: PhotoEntry[];
  alerts: AlertItem[];
};

// ── 入力型 ───────────────────────────────────────────────────────────────────

export type MonitorInput = {
  tasks: Task[];
  dailyReports: DailyReport[];
  chats: ChatMessage[];
  photos: Photo[];
  today: Date;
};

// ── ヘルパー ─────────────────────────────────────────────────────────────────

/** JST (UTC+9) での YYYY-MM-DD 文字列を返す */
function toJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** タスクが今日アクティブ (startDate <= today <= dueDate) か */
function isActiveToday(task: Task, todayStr: string): boolean {
  const start = task.startDate ?? "";
  const end = task.dueDate ?? task.startDate ?? "";
  if (!start) return task.status === "in_progress";
  return start <= todayStr && (end >= todayStr || end === "");
}

/** 雨天天気文字列の簡易判定 */
function isRainyWeather(weather: string | undefined): boolean {
  if (!weather) return false;
  const rainy = ["雨", "大雨", "暴風雨", "雷雨", "小雨", "にわか雨", "rain"];
  return rainy.some((r) => weather.toLowerCase().includes(r.toLowerCase()));
}

// ── filterByToday ─────────────────────────────────────────────────────────────

/**
 * 当日 (JST) の日報・写真のみを抽出する。
 * テスト可能な純粋関数として export。
 */
export function filterByToday(
  dailyReports: DailyReport[],
  photos: Photo[],
  today: Date,
): { reports: DailyReport[]; photos: Photo[] } {
  return {
    reports: filterReportsByToday(dailyReports, today),
    photos: filterPhotosByToday(photos, today),
  };
}

// filterByToday を正しい型で re-export するラッパー (テスト用)
export function filterReportsByToday(dailyReports: DailyReport[], today: Date): DailyReport[] {
  const todayStr = toJSTDateString(today);
  return dailyReports.filter((r) => r.reportDate.slice(0, 10) === todayStr);
}

export function filterPhotosByToday(photos: Photo[], today: Date): Photo[] {
  const todayStr = toJSTDateString(today);
  return photos.filter((p) => {
    const taken = p.takenAt ?? p.createdAt ?? "";
    return taken.slice(0, 10) === todayStr;
  });
}

// ── ganttSummary 集計 ─────────────────────────────────────────────────────────

export function buildGanttSummary(tasks: Task[], today: Date): GanttSummary {
  const todayStr = toJSTDateString(today);

  let delayed = 0;
  let onTrack = 0;
  let ahead = 0;
  let totalProgress = 0;

  const activeTasks = tasks.filter((t) => t.status !== "done");

  for (const task of activeTasks) {
    totalProgress += task.progress ?? 0;

    const due = task.dueDate ?? "";
    if (!due) {
      onTrack++;
      continue;
    }
    if (due < todayStr && task.status !== "done") {
      delayed++;
    } else if (task.progress >= 100) {
      ahead++;
    } else {
      onTrack++;
    }
  }

  const count = activeTasks.length;
  return {
    delayed,
    onTrack,
    ahead,
    totalProgress: count > 0 ? Math.round(totalProgress / count) : 0,
  };
}

// ── alerts 検知 ──────────────────────────────────────────────────────────────

export function buildAlerts(
  tasks: Task[],
  dailyReports: DailyReport[],
  chats: ChatMessage[],
  photos: Photo[],
  today: Date,
  currentUserId?: string,
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayStr = toJSTDateString(today);

  // 1. 遅延タスク
  const delayedTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== "done",
  );
  if (delayedTasks.length > 0) {
    alerts.push({
      id: "delayed-tasks",
      severity: "error",
      message: `遅延タスクが ${delayedTasks.length} 件あります`,
    });
  }

  // 2. 雨天中止 (本日日報の天気)
  const todayReports = dailyReports.filter((r) => r.reportDate.slice(0, 10) === todayStr);
  const rainyReport = todayReports.find((r) => isRainyWeather(r.weather));
  if (rainyReport) {
    alerts.push({
      id: "rainy-weather",
      severity: "warning",
      message: `本日の天気: ${rainyReport.weather ?? "雨"} — 作業中止の可能性があります`,
    });
  }

  // 3. 未読チャット
  const unreadChats = chats.filter((c) => {
    if (!currentUserId) return false;
    const readBy = c.readBy ?? [];
    return !readBy.includes(currentUserId);
  });
  if (unreadChats.length > 0) {
    alerts.push({
      id: "unread-chats",
      severity: "info",
      message: `未読チャットが ${unreadChats.length} 件あります`,
    });
  }

  // 4. 本日の写真ゼロ (in_progress タスクがあるのに写真なし)
  const hasActiveTask = tasks.some((t) => t.status === "in_progress");
  const todayPhotos = filterPhotosByToday(photos, today);
  if (hasActiveTask && todayPhotos.length === 0) {
    alerts.push({
      id: "no-photos-today",
      severity: "warning",
      message: "本日の現場写真がまだ登録されていません",
    });
  }

  return alerts;
}

// ── メイン集計関数 ────────────────────────────────────────────────────────────

/**
 * 全データを受け取り MonitorSnapshot を返す。
 * @param input tasks/dailyReports/chats/photos/today
 * @param currentUserId 未読チャット判定に使う (省略可)
 */
export function aggregateMonitorData(
  input: MonitorInput,
  currentUserId?: string,
): MonitorSnapshot {
  const { tasks, dailyReports, chats, photos, today } = input;

  const ganttSummary = buildGanttSummary(tasks, today);

  const todayReports: DailyReportEntry[] = filterReportsByToday(dailyReports, today)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      projectId: r.projectId,
      reportDate: r.reportDate,
      weather: r.weather,
      content: r.content,
      photoCount: r.photoUrls?.length ?? 0,
      authorId: r.authorId,
    }));

  // チャット: 最新5件 (timestamp 降順)
  const recentChats: ChatMessage[] = [...chats]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  // 写真: 最新6件
  const recentPhotos: PhotoEntry[] = [...photos]
    .sort((a, b) => {
      const aDate = a.takenAt ?? a.createdAt ?? "";
      const bDate = b.takenAt ?? b.createdAt ?? "";
      return bDate.localeCompare(aDate);
    })
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      projectId: p.projectId,
      url: p.url,
      caption: p.caption,
      takenAt: p.takenAt,
    }));

  const alerts = buildAlerts(tasks, dailyReports, chats, photos, today, currentUserId);

  return {
    today,
    ganttSummary,
    todayReports,
    recentChats,
    recentPhotos,
    alerts,
  };
}
