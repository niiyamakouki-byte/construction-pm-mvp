/** 全エンティティ共通フィールド */
export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

// ── Project ─────────────────────────────────────────

export type ProjectStatus = "planning" | "active" | "completed" | "on_hold";

export type Project = BaseEntity & {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
};

// ── Task ────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = BaseEntity & {
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
};

// ── Resource ────────────────────────────────────────

export type ResourceType = "worker" | "equipment" | "material";

export type Resource = BaseEntity & {
  name: string;
  type: ResourceType;
  unit?: string;
};

// ── CostItem ────────────────────────────────────────

export type CostItem = BaseEntity & {
  projectId: string;
  taskId?: string;
  description: string;
  amount: number;
  category: string;
};
