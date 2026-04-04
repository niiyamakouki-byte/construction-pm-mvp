/**
 * E2E: プロジェクト作成フロー
 * InMemoryRepository を直接使用してドメイン層を検証する
 */
import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryRepository } from "../../infra/in-memory-repository.js";
import type { Project, Task, Contractor } from "../../domain/types.js";

// ── テストデータファクトリ ────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: "proj-1",
    name: "渋谷オフィス改修工事",
    description: "テスト用プロジェクト",
    status: "planning",
    startDate: "2025-06-01",
    includeWeekends: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "墨出し・下地確認",
    description: "壁面の下地確認を行う",
    status: "todo",
    progress: 0,
    dependencies: [],
    startDate: "2025-06-01",
    dueDate: "2025-06-03",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── テスト ──────────────────────────────────────────────────

describe("E2E: プロジェクト作成フロー", () => {
  let projectRepo: InMemoryRepository<Project>;
  let taskRepo: InMemoryRepository<Task>;

  beforeEach(() => {
    projectRepo = new InMemoryRepository<Project>();
    taskRepo = new InMemoryRepository<Task>();
  });

  it("プロジェクトを作成して取得できる", async () => {
    const project = makeProject();
    await projectRepo.create(project);

    const found = await projectRepo.findById("proj-1");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("渋谷オフィス改修工事");
    expect(found!.status).toBe("planning");
  });

  it("プロジェクトのステータスをactiveに変更できる", async () => {
    await projectRepo.create(makeProject());
    const updated = await projectRepo.update("proj-1", { status: "active" });

    expect(updated!.status).toBe("active");
    expect(updated!.name).toBe("渋谷オフィス改修工事");
  });

  it("プロジェクト作成後にタスクを追加できる", async () => {
    await projectRepo.create(makeProject());
    await taskRepo.create(makeTask());

    const tasks = await taskRepo.findAll();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].projectId).toBe("proj-1");
  });

  it("複数プロジェクトを作成して一覧取得できる", async () => {
    await projectRepo.create(makeProject({ id: "p-1", name: "工事A" }));
    await projectRepo.create(makeProject({ id: "p-2", name: "工事B" }));
    await projectRepo.create(makeProject({ id: "p-3", name: "工事C" }));

    const all = await projectRepo.findAll();
    expect(all).toHaveLength(3);
    const names = all.map((p) => p.name).sort();
    expect(names).toEqual(["工事A", "工事B", "工事C"]);
  });

  it("プロジェクトを削除するとfindByIdがnullを返す", async () => {
    await projectRepo.create(makeProject());
    await projectRepo.delete("proj-1");

    const found = await projectRepo.findById("proj-1");
    expect(found).toBeNull();
  });

  it("予算フィールドを持つプロジェクトを作成できる", async () => {
    await projectRepo.create(makeProject({ budget: 5000000 }));
    const found = await projectRepo.findById("proj-1");
    expect(found!.budget).toBe(5000000);
  });
});

// ── タスク作成 → ガントチャート用データ検証 ─────────────────────

describe("E2E: タスク作成→ガントチャート表示", () => {
  let taskRepo: InMemoryRepository<Task>;

  beforeEach(() => {
    taskRepo = new InMemoryRepository<Task>();
  });

  it("タスクの開始日と終了日が正しく設定される", async () => {
    await taskRepo.create(
      makeTask({ startDate: "2025-06-01", dueDate: "2025-06-10" }),
    );
    const task = await taskRepo.findById("task-1");
    expect(task!.startDate).toBe("2025-06-01");
    expect(task!.dueDate).toBe("2025-06-10");
  });

  it("複数タスクを作成してガントチャート用に日付順ソートできる", async () => {
    await taskRepo.create(makeTask({ id: "t-1", startDate: "2025-06-05", name: "タスクB" }));
    await taskRepo.create(makeTask({ id: "t-2", startDate: "2025-06-01", name: "タスクA" }));
    await taskRepo.create(makeTask({ id: "t-3", startDate: "2025-06-10", name: "タスクC" }));

    const tasks = await taskRepo.findAll();
    const sorted = [...tasks].sort((a, b) =>
      (a.startDate ?? "").localeCompare(b.startDate ?? ""),
    );

    expect(sorted[0].name).toBe("タスクA");
    expect(sorted[1].name).toBe("タスクB");
    expect(sorted[2].name).toBe("タスクC");
  });

  it("依存関係を持つタスクを作成できる", async () => {
    await taskRepo.create(makeTask({ id: "t-1", name: "先行タスク", dependencies: [] }));
    await taskRepo.create(
      makeTask({ id: "t-2", name: "後続タスク", dependencies: ["t-1"] }),
    );

    const follower = await taskRepo.findById("t-2");
    expect(follower!.dependencies).toContain("t-1");
  });
});
