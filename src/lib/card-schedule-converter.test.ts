/**
 * card-schedule-converter.test.ts
 * カードJSON ⇔ Task[] 往復変換の検証。
 * サンプルは genbahub-schedule-v2-proto/tasks-data.js の実データ（10工種・11接続）を使う。
 */
import { describe, it, expect } from "vitest";
import { cardToTasks, tasksToCard } from "./card-schedule-converter.js";
import type { CardScheduleData } from "./card-schedule-converter.js";

const SAMPLE_CARD: CardScheduleData = {
  taskTypes: [
    { id: "t1", name: "解体", qty: "35㎡", days: 2 },
    { id: "t2", name: "LGS(軽鉄下地)", qty: "35㎡", days: 3 },
    { id: "t6", name: "電気設備配線", qty: "1式", days: 2 },
    { id: "t7", name: "給排水設備配管", qty: "1式", days: 2 },
    { id: "t3", name: "ボード貼り", qty: "35㎡", days: 3 },
    { id: "t4", name: "パテ処理", qty: "35㎡", days: 2 },
    { id: "t5", name: "クロス", qty: "35㎡", days: 3 },
    { id: "t8", name: "床仕上げ(CF)", qty: "30㎡", days: 2 },
    { id: "t9", name: "建具吊り込み", qty: "4箇所", days: 1 },
    { id: "t10", name: "美装(清掃)", qty: "1式", days: 1 },
  ],
  connections: [
    { from: "t1", to: "t2" },
    { from: "t2", to: "t6" },
    { from: "t2", to: "t7" },
    { from: "t6", to: "t3" },
    { from: "t7", to: "t3" },
    { from: "t3", to: "t4" },
    { from: "t4", to: "t5" },
    { from: "t5", to: "t8" },
    { from: "t5", to: "t9" },
    { from: "t8", to: "t10" },
    { from: "t9", to: "t10" },
  ],
  photoStore: {
    t1: { taskId: "", date: "2026-07-10", contractor: "山田解体", photos: [{ dataUrl: "data:image/png;base64,abc", addedAt: "2026-07-10T01:00:00.000Z" }] },
  },
};

function sortConnections(conns: { from: string; to: string }[]) {
  return [...conns].sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`));
}

describe("cardToTasks", () => {
  it("全カードをTaskに変換し、projectId・依存関係・所要日数を保持する", () => {
    const { tasks, idMap } = cardToTasks(SAMPLE_CARD, "proj-1");

    expect(tasks).toHaveLength(10);
    expect(Object.keys(idMap)).toHaveLength(10);
    for (const task of tasks) {
      expect(task.projectId).toBe("proj-1");
      expect(task.status).toBe("todo");
    }

    const t3 = tasks.find((t) => t.id === idMap.t3)!;
    expect(t3.name).toBe("ボード貼り");
    expect(t3.leadTimeDays).toBe(3);
    expect(t3.description).toBe("35㎡");
    // t3 は t6, t7 完了後に開始（DEFAULT_CONNECTIONS通り）
    expect(t3.dependencies.sort()).toEqual([idMap.t6, idMap.t7].sort());
    expect(t3.dependencyType).toBe("FS");

    const t1 = tasks.find((t) => t.id === idMap.t1)!;
    expect(t1.dependencies).toEqual([]);
  });
});

describe("cardToTasks -> tasksToCard 往復変換", () => {
  it("taskTypes・connectionsが元データと一致する（photoStoreは素通し）", () => {
    const { tasks, idMap } = cardToTasks(SAMPLE_CARD, "proj-1");
    const roundTripped = tasksToCard(tasks, idMap, SAMPLE_CARD.photoStore);

    expect(roundTripped.taskTypes).toEqual(SAMPLE_CARD.taskTypes);
    expect(sortConnections(roundTripped.connections)).toEqual(sortConnections(SAMPLE_CARD.connections));
    expect(roundTripped.photoStore).toEqual(SAMPLE_CARD.photoStore);
  });
});
