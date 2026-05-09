/**
 * monitor-aggregator テスト
 * filterByToday / ganttSummary / alerts / 空入力 をカバー
 */

import { describe, it, expect } from "vitest";
import {
  aggregateMonitorData,
  buildGanttSummary,
  buildAlerts,
  filterReportsByToday,
  filterPhotosByToday,
} from "../lib/monitor-tool/monitor-aggregator.js";
import type { Task, DailyReport, ChatMessage, Photo } from "../domain/types.js";

// ── ファクトリ ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    projectId: "proj-1",
    name: "テストタスク",
    description: "",
    status: "in_progress",
    progress: 50,
    dependencies: [],
    ...overrides,
  };
}

function makeDailyReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    id: `report-${Math.random().toString(36).slice(2)}`,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    projectId: "proj-1",
    reportDate: "2026-05-09",
    content: "作業完了",
    photoUrls: [],
    ...overrides,
  };
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: `photo-${Math.random().toString(36).slice(2)}`,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    projectId: "proj-1",
    url: "https://example.com/photo.jpg",
    takenAt: "2026-05-09T09:00:00.000Z",
    ...overrides,
  };
}

function makeChat(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `chat-${Math.random().toString(36).slice(2)}`,
    projectId: "proj-1",
    userId: "user-1",
    userName: "鈴木",
    content: "確認しました",
    timestamp: "2026-05-09T09:00:00.000Z",
    readBy: ["user-1"],
    ...overrides,
  };
}

const TODAY = new Date("2026-05-09T03:00:00.000Z"); // JST 2026-05-09 12:00

// ── filterReportsByToday ──────────────────────────────────────────────────────

describe("filterReportsByToday", () => {
  it("当日の日報のみ返す", () => {
    const reports = [
      makeDailyReport({ reportDate: "2026-05-09" }),
      makeDailyReport({ reportDate: "2026-05-08" }),
      makeDailyReport({ reportDate: "2026-05-10" }),
    ];
    const result = filterReportsByToday(reports, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].reportDate).toBe("2026-05-09");
  });

  it("空配列を渡すと空を返す", () => {
    expect(filterReportsByToday([], TODAY)).toHaveLength(0);
  });

  it("当日がなければ空を返す", () => {
    const reports = [makeDailyReport({ reportDate: "2026-05-08" })];
    expect(filterReportsByToday(reports, TODAY)).toHaveLength(0);
  });
});

// ── filterPhotosByToday ───────────────────────────────────────────────────────

describe("filterPhotosByToday", () => {
  it("当日 takenAt の写真のみ返す", () => {
    const photos = [
      makePhoto({ takenAt: "2026-05-09T10:00:00.000Z" }),
      makePhoto({ takenAt: "2026-05-08T10:00:00.000Z" }),
    ];
    const result = filterPhotosByToday(photos, TODAY);
    expect(result).toHaveLength(1);
  });

  it("takenAt がない場合は createdAt で判定する", () => {
    const photos = [
      makePhoto({ takenAt: undefined, createdAt: "2026-05-09T05:00:00.000Z" }),
      makePhoto({ takenAt: undefined, createdAt: "2026-05-08T05:00:00.000Z" }),
    ];
    const result = filterPhotosByToday(photos, TODAY);
    expect(result).toHaveLength(1);
  });

  it("空配列を渡すと空を返す", () => {
    expect(filterPhotosByToday([], TODAY)).toHaveLength(0);
  });
});

// ── buildGanttSummary ─────────────────────────────────────────────────────────

describe("buildGanttSummary", () => {
  it("遅延タスクをカウントする", () => {
    const tasks = [
      makeTask({ dueDate: "2026-05-08", status: "in_progress", progress: 30 }),
      makeTask({ dueDate: "2026-05-10", status: "in_progress", progress: 50 }),
    ];
    const result = buildGanttSummary(tasks, TODAY);
    expect(result.delayed).toBe(1);
    expect(result.onTrack).toBe(1);
  });

  it("完了タスクは集計から除外する", () => {
    const tasks = [
      makeTask({ status: "done", progress: 100 }),
    ];
    const result = buildGanttSummary(tasks, TODAY);
    expect(result.delayed + result.onTrack + result.ahead).toBe(0);
  });

  it("totalProgress を平均計算する", () => {
    const tasks = [
      makeTask({ status: "in_progress", progress: 40 }),
      makeTask({ status: "in_progress", progress: 60 }),
    ];
    const result = buildGanttSummary(tasks, TODAY);
    expect(result.totalProgress).toBe(50);
  });

  it("タスクゼロなら totalProgress=0", () => {
    const result = buildGanttSummary([], TODAY);
    expect(result.totalProgress).toBe(0);
    expect(result.delayed).toBe(0);
  });

  it("前倒しタスク (progress=100 かつ期限内) をカウントする", () => {
    const tasks = [
      makeTask({ dueDate: "2026-05-15", status: "in_progress", progress: 100 }),
    ];
    const result = buildGanttSummary(tasks, TODAY);
    expect(result.ahead).toBe(1);
  });
});

// ── buildAlerts ───────────────────────────────────────────────────────────────

describe("buildAlerts", () => {
  it("遅延タスクがあると delayed-tasks アラートを返す", () => {
    const tasks = [
      makeTask({ dueDate: "2026-05-08", status: "in_progress" }),
    ];
    const alerts = buildAlerts(tasks, [], [], [], TODAY);
    expect(alerts.some((a) => a.id === "delayed-tasks")).toBe(true);
    expect(alerts.find((a) => a.id === "delayed-tasks")?.severity).toBe("error");
  });

  it("雨天日報があると rainy-weather アラートを返す", () => {
    const reports = [makeDailyReport({ reportDate: "2026-05-09", weather: "雨" })];
    const alerts = buildAlerts([], reports, [], [], TODAY);
    expect(alerts.some((a) => a.id === "rainy-weather")).toBe(true);
    expect(alerts.find((a) => a.id === "rainy-weather")?.severity).toBe("warning");
  });

  it("晴れ天気なら rainy-weather アラートを出さない", () => {
    const reports = [makeDailyReport({ reportDate: "2026-05-09", weather: "晴れ" })];
    const alerts = buildAlerts([], reports, [], [], TODAY);
    expect(alerts.some((a) => a.id === "rainy-weather")).toBe(false);
  });

  it("未読チャットがあると unread-chats アラートを返す", () => {
    const chats = [makeChat({ readBy: [] })];
    const alerts = buildAlerts([], [], chats, [], TODAY, "user-99");
    expect(alerts.some((a) => a.id === "unread-chats")).toBe(true);
    expect(alerts.find((a) => a.id === "unread-chats")?.severity).toBe("info");
  });

  it("currentUserId が未指定なら unread-chats は出ない", () => {
    const chats = [makeChat({ readBy: [] })];
    const alerts = buildAlerts([], [], chats, [], TODAY, undefined);
    expect(alerts.some((a) => a.id === "unread-chats")).toBe(false);
  });

  it("in_progress タスクがあるのに今日の写真ゼロなら no-photos-today アラート", () => {
    const tasks = [makeTask({ status: "in_progress" })];
    const alerts = buildAlerts(tasks, [], [], [], TODAY);
    expect(alerts.some((a) => a.id === "no-photos-today")).toBe(true);
  });

  it("今日の写真があれば no-photos-today は出ない", () => {
    const tasks = [makeTask({ status: "in_progress" })];
    const photos = [makePhoto({ takenAt: "2026-05-09T10:00:00.000Z" })];
    const alerts = buildAlerts(tasks, [], [], photos, TODAY);
    expect(alerts.some((a) => a.id === "no-photos-today")).toBe(false);
  });

  it("全て正常なら空アレイ", () => {
    const tasks = [makeTask({ status: "in_progress", dueDate: "2026-05-15" })];
    const photos = [makePhoto({ takenAt: "2026-05-09T10:00:00.000Z" })];
    const chats = [makeChat({ readBy: ["user-1"] })];
    const reports = [makeDailyReport({ weather: "晴れ" })];
    const alerts = buildAlerts(tasks, reports, chats, photos, TODAY, "user-1");
    expect(alerts).toHaveLength(0);
  });
});

// ── aggregateMonitorData ──────────────────────────────────────────────────────

describe("aggregateMonitorData", () => {
  it("空入力でも MonitorSnapshot を返す", () => {
    const result = aggregateMonitorData({
      tasks: [],
      dailyReports: [],
      chats: [],
      photos: [],
      today: TODAY,
    });
    expect(result.ganttSummary.totalProgress).toBe(0);
    expect(result.todayReports).toHaveLength(0);
    expect(result.recentChats).toHaveLength(0);
    expect(result.recentPhotos).toHaveLength(0);
    expect(result.alerts).toHaveLength(0);
  });

  it("日報は最大3件に絞る", () => {
    const reports = Array.from({ length: 5 }, (_, i) =>
      makeDailyReport({ id: `r${i}`, reportDate: "2026-05-09" }),
    );
    const result = aggregateMonitorData({
      tasks: [],
      dailyReports: reports,
      chats: [],
      photos: [],
      today: TODAY,
    });
    expect(result.todayReports.length).toBeLessThanOrEqual(3);
  });

  it("チャットは最大5件 (降順)", () => {
    const chats = Array.from({ length: 8 }, (_, i) =>
      makeChat({
        id: `c${i}`,
        timestamp: `2026-05-09T0${i}:00:00.000Z`,
      }),
    );
    const result = aggregateMonitorData({
      tasks: [],
      dailyReports: [],
      chats,
      photos: [],
      today: TODAY,
    });
    expect(result.recentChats.length).toBeLessThanOrEqual(5);
    // 降順確認
    for (let i = 1; i < result.recentChats.length; i++) {
      expect(result.recentChats[i - 1].timestamp >= result.recentChats[i].timestamp).toBe(true);
    }
  });

  it("写真は最大6件", () => {
    const photos = Array.from({ length: 10 }, (_, i) =>
      makePhoto({ id: `p${i}`, takenAt: `2026-05-09T0${i % 10}:00:00.000Z` }),
    );
    const result = aggregateMonitorData({
      tasks: [],
      dailyReports: [],
      chats: [],
      photos,
      today: TODAY,
    });
    expect(result.recentPhotos.length).toBeLessThanOrEqual(6);
  });

  it("today が MonitorSnapshot に含まれる", () => {
    const result = aggregateMonitorData({
      tasks: [],
      dailyReports: [],
      chats: [],
      photos: [],
      today: TODAY,
    });
    expect(result.today).toEqual(TODAY);
  });
});
