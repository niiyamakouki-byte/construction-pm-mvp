/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { SupabaseStore, type SupabaseClientLike } from "./supabase-store.js";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

class MockSupabaseQueryBuilder<T extends Row> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private filters: Array<{ column: string; value: unknown }> = [];
  private orderBy?: { column: string; ascending: boolean };
  private insertRows: T[] = [];
  private patch: Partial<T> = {};

  constructor(
    private readonly tables: Tables,
    private readonly tableName: string,
  ) {
    this.tables[tableName] ??= [];
  }

  select(_columns?: string) {
    return this;
  }

  insert(values: Row | Row[]) {
    this.action = "insert";
    this.insertRows = (Array.isArray(values) ? values : [values]).map((value) =>
      structuredClone(value),
    ) as T[];
    return this;
  }

  update(values: Row) {
    this.action = "update";
    this.patch = structuredClone(values) as Partial<T>;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending !== false,
    };
    return this;
  }

  single() {
    return this.execute({ single: true });
  }

  maybeSingle() {
    return this.execute({ maybeSingle: true });
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: T | T[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute({}).then(onfulfilled, onrejected);
  }

  private async execute(options: { single?: boolean; maybeSingle?: boolean }) {
    const rows = this.tables[this.tableName] as T[];
    const matches = rows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    );

    let data: T | T[] | null;

    if (this.action === "insert") {
      rows.push(...this.insertRows.map((row) => structuredClone(row)));
      data = this.insertRows.length === 1 ? structuredClone(this.insertRows[0]) : structuredClone(this.insertRows);
    } else if (this.action === "update") {
      const updatedRows = matches.map((row) => Object.assign(row, structuredClone(this.patch)));
      data =
        updatedRows.length === 1 ? structuredClone(updatedRows[0]) : structuredClone(updatedRows);
    } else if (this.action === "delete") {
      const deletedRows = matches.map((row) => structuredClone(row));
      this.tables[this.tableName] = rows.filter(
        (row) => !matches.some((match) => match.id === row.id),
      );
      data = deletedRows.length === 1 ? deletedRows[0] : deletedRows;
    } else {
      const selectedRows = matches.map((row) => structuredClone(row));
      if (this.orderBy) {
        selectedRows.sort((left, right) => {
          const leftValue = left[this.orderBy!.column];
          const rightValue = right[this.orderBy!.column];
          if (leftValue === rightValue) {
            return 0;
          }
          if (leftValue === undefined || leftValue === null) {
            return this.orderBy!.ascending ? -1 : 1;
          }
          if (rightValue === undefined || rightValue === null) {
            return this.orderBy!.ascending ? 1 : -1;
          }
          return leftValue < rightValue
            ? (this.orderBy!.ascending ? -1 : 1)
            : (this.orderBy!.ascending ? 1 : -1);
        });
      }
      data = selectedRows;
    }

    if (options.single) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }
    if (options.maybeSingle) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }

    return { data, error: null };
  }
}

function createMockSupabaseClient(initialTables: Partial<Tables> = {}): SupabaseClientLike {
  const tables: Tables = {
    projects: structuredClone(initialTables.projects ?? []),
    tasks: structuredClone(initialTables.tasks ?? []),
    contractors: structuredClone(initialTables.contractors ?? []),
    materials: structuredClone(initialTables.materials ?? []),
    change_orders: structuredClone(initialTables.change_orders ?? []),
    notifications: structuredClone(initialTables.notifications ?? []),
  };

  return {
    from(table: string) {
      return new MockSupabaseQueryBuilder(tables, table);
    },
  } as unknown as SupabaseClientLike;
}

describe("SupabaseStore", () => {
  it("creates and updates projects and related records", async () => {
    const store = new SupabaseStore({
      client: createMockSupabaseClient(),
    });

    const project = await store.createProject({
      name: "GenbaHub HQ",
      contractor: "Field Club",
      address: "Tokyo",
      status: "planning",
      clientId: "client-001",
      clientName: "Sample Co",
      contractAmount: 1250000,
      contractDate: "2026-01-05",
      inspectionDate: "2026-02-10",
      handoverDate: "2026-02-20",
      warrantyEndDate: "2027-02-20",
    });

    const contractor = await store.createContractor({
      name: "Tokyo LGS",
      trade: "LGS",
      phone: "03-0000-0000",
      email: "lgs@example.com",
    });

    const task = await store.createTask(project.id, {
      name: "LGS",
      description: "framing",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
      contractorId: contractor.id,
      contractor: contractor.name,
      progress: 10,
      cost: 50000,
    });

    await store.createMaterial(project.id, {
      name: "Board",
      quantity: 20,
      unit: "sheets",
      unitPrice: 1200,
      supplier: "Build Co",
      deliveryDate: "2026-01-09",
      status: "ordered",
    });

    await store.createChangeOrder(project.id, {
      description: "Signage update",
      amount: 80000,
      approvedBy: "PM",
      date: "2026-01-15",
      status: "approved",
    });

    const updatedProject = await store.updateProject(project.id, {
      status: "active",
      description: "renovation",
      endDate: "2026-02-20",
      contractAmount: null,
    });

    const updatedTask = await store.updateTask(task.id, {
      status: "in_progress",
      progress: 55,
      cost: 88000,
    });

    expect(await store.listProjects()).toEqual([
      expect.objectContaining({
        id: project.id,
        status: "active",
      }),
    ]);
    expect(updatedProject).toMatchObject({
      id: project.id,
      status: "active",
      description: "renovation",
      endDate: "2026-02-20",
      contractAmount: undefined,
    });
    expect(await store.getContractor(contractor.id)).toMatchObject({
      id: contractor.id,
      name: contractor.name,
    });
    expect(await store.listTasks(project.id)).toEqual([
      expect.objectContaining({
        id: task.id,
        contractorId: contractor.id,
      }),
    ]);
    expect(updatedTask).toMatchObject({
      id: task.id,
      status: "in_progress",
      progress: 55,
      cost: 88000,
    });
    expect(await store.listMaterials(project.id)).toEqual([
      expect.objectContaining({
        projectId: project.id,
        name: "Board",
      }),
    ]);
    expect(await store.listChangeOrders(project.id)).toEqual([
      expect.objectContaining({
        projectId: project.id,
        description: "Signage update",
      }),
    ]);
  });

  it("removes task dependencies when a predecessor task is deleted", async () => {
    const store = new SupabaseStore({
      client: createMockSupabaseClient(),
    });

    const project = await store.createProject({
      name: "Dependency Project",
      contractor: "Field Club",
      address: "Tokyo",
      status: "planning",
    });

    const predecessor = await store.createTask(project.id, {
      name: "Demolition",
      description: "",
      startDate: "2026-01-10",
      endDate: "2026-01-11",
    });
    const successor = await store.createTask(project.id, {
      name: "LGS",
      description: "",
      startDate: "2026-01-12",
      endDate: "2026-01-13",
    });

    await store.updateTask(successor.id, {
      dependencies: [
        {
          predecessorId: predecessor.id,
          type: "FS",
          lagDays: 0,
        },
      ],
    });

    expect(await store.deleteTask(predecessor.id)).toBe(true);
    expect(await store.getTask(predecessor.id)).toBeNull();
    expect(await store.getTask(successor.id)).toMatchObject({
      id: successor.id,
      dependencies: [],
    });
  });

  it("creates notifications and tracks unread counts", async () => {
    const store = new SupabaseStore({
      client: createMockSupabaseClient(),
    });

    const project = await store.createProject({
      name: "Notification Project",
      contractor: "Field Club",
      address: "Tokyo",
      status: "planning",
    });

    const unread = await store.createNotification({
      type: "task_status_changed",
      message: "Task updated",
      projectId: project.id,
      recipientId: "user-1",
      priority: "medium",
    });
    await store.createNotification({
      type: "material_delivery_due",
      message: "Material due",
      projectId: project.id,
      recipientId: "user-1",
      priority: "high",
    });

    expect(await store.countUnreadNotifications()).toBe(2);
    expect(await store.listNotifications({ read: false })).toHaveLength(2);

    const marked = await store.markNotificationRead(unread.id);

    expect(marked).toMatchObject({
      id: unread.id,
      read: true,
    });
    expect(marked?.readAt).toEqual(expect.any(String));
    expect(await store.countUnreadNotifications()).toBe(1);
    expect(await store.listNotifications({ read: true })).toEqual([
      expect.objectContaining({
        id: unread.id,
        read: true,
      }),
    ]);
  });

  it("deletes a project and its scoped records", async () => {
    const store = new SupabaseStore({
      client: createMockSupabaseClient(),
    });

    const project = await store.createProject({
      name: "Delete Project",
      contractor: "Field Club",
      address: "Tokyo",
      status: "planning",
    });

    await store.createTask(project.id, {
      name: "Task",
      description: "",
      startDate: "2026-01-10",
      endDate: "2026-01-11",
    });
    await store.createMaterial(project.id, {
      name: "Board",
      quantity: 5,
      unit: "sheets",
      unitPrice: 1000,
      supplier: "Build Co",
      deliveryDate: "2026-01-10",
      status: "ordered",
    });
    await store.createChangeOrder(project.id, {
      description: "Extra work",
      amount: 20000,
      approvedBy: "PM",
      date: "2026-01-10",
      status: "pending",
    });
    await store.createNotification({
      type: "task_status_changed",
      message: "Task updated",
      projectId: project.id,
      recipientId: "user-1",
      priority: "low",
    });

    expect(await store.deleteProject(project.id)).toBe(true);
    expect(await store.getProject(project.id)).toBeNull();
    expect(await store.listTasks(project.id)).toEqual([]);
    expect(await store.listMaterials(project.id)).toEqual([]);
    expect(await store.listChangeOrders(project.id)).toEqual([]);
    expect(await store.listNotifications()).toEqual([]);
  });
});
