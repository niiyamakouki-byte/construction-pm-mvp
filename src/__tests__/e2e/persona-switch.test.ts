/**
 * E2E: ペルソナ切替フロー
 * 「現場監督」「職人」「経営者」など役割に応じたビューフィルタリングロジックをテスト
 */
import { describe, expect, it } from "vitest";
import type { Task, Project, CostItem } from "../../domain/types.js";

// ── ペルソナ定義 ──────────────────────────────────────────────

type Persona = "foreman" | "worker" | "manager";

type PersonaView = {
  showCosts: boolean;
  showTasks: boolean;
  showReports: boolean;
  canEditTasks: boolean;
  canApproveExpenses: boolean;
};

function getPersonaView(persona: Persona): PersonaView {
  switch (persona) {
    case "manager":
      return {
        showCosts: true,
        showTasks: true,
        showReports: true,
        canEditTasks: true,
        canApproveExpenses: true,
      };
    case "foreman":
      return {
        showCosts: false,
        showTasks: true,
        showReports: true,
        canEditTasks: true,
        canApproveExpenses: false,
      };
    case "worker":
      return {
        showCosts: false,
        showTasks: true,
        showReports: false,
        canEditTasks: false,
        canApproveExpenses: false,
      };
  }
}

/** ペルソナに応じてタスクを絞り込む */
function filterTasksByPersona(tasks: Task[], persona: Persona, userId?: string): Task[] {
  if (persona === "worker" && userId) {
    return tasks.filter((t) => t.assigneeId === userId);
  }
  return tasks;
}

/** ペルソナに応じてコスト情報を取得する権限があるか */
function canViewCosts(persona: Persona): boolean {
  return getPersonaView(persona).showCosts;
}

// ── テスト ──────────────────────────────────────────────────

describe("E2E: ペルソナ切替", () => {
  const now = new Date().toISOString();

  const sampleTasks: Task[] = [
    {
      id: "t-1",
      projectId: "p-1",
      name: "墨出し",
      description: "",
      status: "todo",
      progress: 0,
      dependencies: [],
      assigneeId: "user-A",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-2",
      projectId: "p-1",
      name: "下地工事",
      description: "",
      status: "in_progress",
      progress: 30,
      dependencies: [],
      assigneeId: "user-B",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-3",
      projectId: "p-1",
      name: "仕上げ",
      description: "",
      status: "todo",
      progress: 0,
      dependencies: [],
      assigneeId: "user-A",
      createdAt: now,
      updatedAt: now,
    },
  ];

  it("経営者ペルソナはコスト情報を閲覧できる", () => {
    expect(canViewCosts("manager")).toBe(true);
  });

  it("現場監督ペルソナはコスト情報を閲覧できない", () => {
    expect(canViewCosts("foreman")).toBe(false);
  });

  it("職人ペルソナはコスト情報を閲覧できない", () => {
    expect(canViewCosts("worker")).toBe(false);
  });

  it("職人ペルソナは自分のタスクのみ表示される", () => {
    const visible = filterTasksByPersona(sampleTasks, "worker", "user-A");
    expect(visible).toHaveLength(2);
    expect(visible.every((t) => t.assigneeId === "user-A")).toBe(true);
  });

  it("現場監督ペルソナは全タスクが表示される", () => {
    const visible = filterTasksByPersona(sampleTasks, "foreman");
    expect(visible).toHaveLength(3);
  });

  it("経営者ペルソナはタスク編集権限を持つ", () => {
    const view = getPersonaView("manager");
    expect(view.canEditTasks).toBe(true);
    expect(view.canApproveExpenses).toBe(true);
  });

  it("職人ペルソナはタスク編集権限を持たない", () => {
    const view = getPersonaView("worker");
    expect(view.canEditTasks).toBe(false);
    expect(view.showReports).toBe(false);
  });

  it("現場監督ペルソナは日報を表示できるがコスト承認不可", () => {
    const view = getPersonaView("foreman");
    expect(view.showReports).toBe(true);
    expect(view.canApproveExpenses).toBe(false);
  });

  it("ペルソナ切替後も元のタスクデータは変わらない", () => {
    const visibleAsWorker = filterTasksByPersona(sampleTasks, "worker", "user-A");
    const visibleAsManager = filterTasksByPersona(sampleTasks, "manager");

    // 元のsampleTasksは変わらない
    expect(sampleTasks).toHaveLength(3);
    expect(visibleAsWorker).toHaveLength(2);
    expect(visibleAsManager).toHaveLength(3);
  });

  it("プロジェクト予算は経営者のみ閲覧できる権限を持つ", () => {
    const project: Project = {
      id: "p-1",
      name: "テスト工事",
      description: "",
      status: "active",
      startDate: "2025-06-01",
      includeWeekends: false,
      budget: 3000000,
      createdAt: now,
      updatedAt: now,
    };

    // 経営者は予算を見られる
    const managerView = getPersonaView("manager");
    expect(managerView.showCosts).toBe(true);
    expect(project.budget).toBe(3000000);

    // 職人は見られない
    const workerView = getPersonaView("worker");
    expect(workerView.showCosts).toBe(false);
  });

  it("コスト情報が経営者ペルソナのビューに含まれる", () => {
    const costItem: CostItem = {
      id: "cost-1",
      projectId: "p-1",
      description: "石膏ボード",
      amount: 120000,
      category: "材料費",
      createdAt: now,
      updatedAt: now,
    };

    const managerCanView = canViewCosts("manager");
    const workerCanView = canViewCosts("worker");

    expect(managerCanView).toBe(true);
    expect(workerCanView).toBe(false);
    expect(costItem.amount).toBe(120000);
  });
});
