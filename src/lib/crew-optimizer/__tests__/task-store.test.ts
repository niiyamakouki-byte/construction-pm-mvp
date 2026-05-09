/**
 * Tests for TaskAssignmentStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { TaskAssignmentStore, _resetTaskAssignmentStore } from "../task-store.js";
import type { TaskAssignment } from "../types.js";

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function makeTask(id: string): TaskAssignment {
  return {
    id,
    projectId: "p001",
    projectName: "テスト案件",
    taskName: `タスク ${id}`,
    requiredSkills: ["demolition"],
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    siteLat: 35.68,
    siteLng: 139.69,
    peopleNeeded: 1,
    priority: 3,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetTaskAssignmentStore();
});

describe("TaskAssignmentStore — 基本操作", () => {
  it("初期状態で all() は空配列", () => {
    const store = new TaskAssignmentStore();
    expect(store.all()).toHaveLength(0);
  });

  it("add() でタスクが追加される", () => {
    const store = new TaskAssignmentStore();
    store.add(makeTask("t001"));
    expect(store.all()).toHaveLength(1);
  });

  it("saveAll() で一括保存できる", () => {
    const store = new TaskAssignmentStore();
    store.saveAll([makeTask("t001"), makeTask("t002"), makeTask("t003")]);
    expect(store.all()).toHaveLength(3);
  });
});

describe("TaskAssignmentStore — 5000件上限", () => {
  it("5001件追加時に先頭が削除される", () => {
    const store = new TaskAssignmentStore();
    store.add(makeTask("first"));
    const bulk: TaskAssignment[] = [];
    for (let i = 0; i < 5000; i++) {
      bulk.push(makeTask(`t${String(i).padStart(4, "0")}`));
    }
    store.saveAll([makeTask("first"), ...bulk]);
    const all = store.all();
    expect(all).toHaveLength(5000);
    expect(all.find((t) => t.id === "first")).toBeUndefined();
  });
});

describe("TaskAssignmentStore — seed", () => {
  it("ensureSeed() で seed 50件が読み込まれる", () => {
    const store = new TaskAssignmentStore();
    store.ensureSeed();
    expect(store.all()).toHaveLength(50);
  });
});

describe("TaskAssignmentStore — EventTarget", () => {
  it("add() で 'task-added' イベントが発火", () => {
    const store = new TaskAssignmentStore();
    let fired = false;
    store.addEventListener("task-added", () => {
      fired = true;
    });
    store.add(makeTask("t001"));
    expect(fired).toBe(true);
  });
});
