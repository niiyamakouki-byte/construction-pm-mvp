/**
 * card-schedule-converter.ts
 * 「工程データは1つ、見え方が2つ」変換層（工程カードビュー統合 第1弾）。
 *
 * genbahub-schedule-v2-proto のカードJSON (TASK_TYPES / DEFAULT_CONNECTIONS / photoStore)
 * ⇔ construction-pm-mvp の Task[] (domain/types.js) を相互変換する。
 *
 * スコープ: 依存グラフ(工種名・所要日数・前後関係)の往復変換のみ。
 * - qty はTaskに専用フィールドが無いため description にそのまま入れる。
 * - days は Task.leadTimeDays (既存フィールド、GanttPageが所要日数として使用) に入れる。
 * - startDate/dueDateの自動割付はスコープ外（既存の cascade-scheduler 等に委譲）。
 * - photoStore はTask側に対応する型が無い（Photoエンティティはtask単位でなくprojectId単位・
 *   dataUrlでなくstorage URL）ため素通し(pass-through)のみ。
 *   ponytail: photoStore→Photoエンティティの正式マッピングは未実装（この変換層はpass-throughの天井）。
 *   カードビューで写真アップロードを本実装する時に、dataUrlのアップロード→Photo.url変換を追加する。
 */
import type { Task } from "../domain/types.js";

export type CardTaskType = { id: string; name: string; qty: string; days: number };
export type CardConnection = { from: string; to: string };
export type CardPhoto = { dataUrl: string; addedAt: string };
export type CardPhotoRecord = {
  taskId: string;
  date: string;
  contractor: string;
  photos: CardPhoto[];
};

export type CardScheduleData = {
  taskTypes: CardTaskType[];
  connections: CardConnection[];
  photoStore: Record<string, CardPhotoRecord>;
};

export type CardToTaskResult = {
  tasks: Task[];
  /** cardId (t1, t2...) -> 生成された Task.id。tasksToCard で逆変換する際に渡す。 */
  idMap: Record<string, string>;
};

/**
 * カードJSON -> Task[]
 * connections (from完了→to開始) は to 側 Task の dependencies + dependencyType:'FS' に変換する。
 */
export function cardToTasks(card: CardScheduleData, projectId: string): CardToTaskResult {
  const idMap: Record<string, string> = {};
  for (const t of card.taskTypes) {
    idMap[t.id] = crypto.randomUUID();
  }

  const dependsOn = new Map<string, string[]>();
  for (const conn of card.connections) {
    const list = dependsOn.get(conn.to) ?? [];
    list.push(conn.from);
    dependsOn.set(conn.to, list);
  }

  const ts = new Date().toISOString();
  const tasks: Task[] = card.taskTypes.map((t) => ({
    id: idMap[t.id],
    projectId,
    name: t.name,
    description: t.qty,
    status: "todo",
    startDate: null,
    dueDate: null,
    progress: 0,
    dependencies: (dependsOn.get(t.id) ?? []).map((fromCardId) => idMap[fromCardId]),
    dependencyType: "FS",
    leadTimeDays: t.days,
    createdAt: ts,
    updatedAt: ts,
  }));

  return { tasks, idMap };
}

/**
 * Task[] -> カードJSON（cardToTasks の逆変換）。
 * idMap は cardToTasks が返したものをそのまま渡す（cardId -> taskId）。
 * photoStore は呼び出し側が持っているものをそのまま返す（Task側に対応フィールドが無いため素通し）。
 */
export function tasksToCard(
  tasks: Task[],
  idMap: Record<string, string>,
  photoStore: Record<string, CardPhotoRecord> = {},
): CardScheduleData {
  const taskIdToCardId = new Map(Object.entries(idMap).map(([cardId, taskId]) => [taskId, cardId]));

  const taskTypes: CardTaskType[] = tasks.map((t) => ({
    id: taskIdToCardId.get(t.id) ?? t.id,
    name: t.name,
    qty: t.description,
    days: t.leadTimeDays ?? 0,
  }));

  const connections: CardConnection[] = [];
  for (const t of tasks) {
    const toCardId = taskIdToCardId.get(t.id) ?? t.id;
    for (const depTaskId of t.dependencies) {
      const fromCardId = taskIdToCardId.get(depTaskId) ?? depTaskId;
      connections.push({ from: fromCardId, to: toCardId });
    }
  }

  return { taskTypes, connections, photoStore };
}
