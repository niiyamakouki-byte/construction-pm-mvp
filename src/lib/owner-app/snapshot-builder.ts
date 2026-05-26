/**
 * owner-app/snapshot-builder.ts — OwnerDashboardSnapshot 組み立て
 * GanttStore / PhotoStore / ChatStore / OwnerStore から集約する。
 */

import type { OwnerDashboardSnapshot, OwnerMessage } from "./types.js";
import { ownerStore } from "./owner-store.js";
import { getMessages } from "../chat-store.js";
import { fetchProjectTasks } from "../project-tasks-store.js";

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function nextWeekIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

/**
 * GanttStore (project-tasks-store) から進捗率を算出する。
 * status === 'done' のタスク数 / 総タスク数 × 100
 */
async function calcProgress(projectId: string): Promise<number> {
  const tasks = await fetchProjectTasks(projectId);
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

/**
 * 今日のタスク or 最も近いタスクのカテゴリを現フェーズとする。
 */
async function detectCurrentPhase(projectId: string): Promise<string> {
  const tasks = await fetchProjectTasks(projectId);
  const today = todayIso();
  const next7 = nextWeekIso();

  const active = tasks.filter(
    (t) => t.status !== "done" && t.startDate <= today && t.endDate >= today,
  );
  if (active.length > 0) return active[0].category;

  const upcoming = tasks.filter(
    (t) => t.status !== "done" && t.startDate > today && t.startDate <= next7,
  );
  if (upcoming.length > 0) return upcoming[0].category;

  const inProg = tasks.filter((t) => t.status === "in_progress");
  if (inProg.length > 0) return inProg[0].category;

  return "施工中";
}

/**
 * ChatStore の最新10件を OwnerMessage 形式に変換する。
 */
function buildRecentMessages(projectId: string): OwnerMessage[] {
  const msgs = getMessages(projectId, 10);
  return msgs.map((m) => ({
    id: m.id,
    sender: (m.userId === "owner" ? "owner" : "pm") as "owner" | "pm",
    text: m.content,
    ts: m.timestamp,
    attachments: m.attachments,
  }));
}

/**
 * OwnerDashboardSnapshot を組み立てて返す。
 * todaysPhotos は呼び出し元から注入する (async photo-store は component 側で解決)。
 */
export async function buildOwnerSnapshot(
  projectId: string,
  projectName: string,
  todaysPhotos: string[] = [],
): Promise<OwnerDashboardSnapshot> {
  const [overallProgress, currentPhase] = await Promise.all([
    calcProgress(projectId),
    detectCurrentPhase(projectId),
  ]);

  const recentMessages = buildRecentMessages(projectId);

  const { requests } = ownerStore.getSnapshot(projectId);
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return {
    projectId,
    projectName,
    overallProgress,
    currentPhase,
    todaysPhotos: todaysPhotos.slice(0, 6),
    recentMessages,
    pendingRequests,
  };
}
