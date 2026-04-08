/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  listTasks,
  createTask,
  updateTask,
  searchProjects,
  type ProjectRow,
  type TaskRow,
} from "./supabase-tools.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

class MockQueryBuilder<T extends Row> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private eqFilters: Array<{ column: string; value: unknown }> = [];
  private orFilter = "";
  private orderByCol = "";
  private orderAsc = true;
  private insertData: T[] = [];
  private patchData: Partial<T> = {};

  constructor(
    private readonly tables: Tables,
    private readonly tableName: string,
  ) {
    this.tables[tableName] ??= [];
  }

  select(_cols?: string) { return this; }

  insert(values: Row | Row[]) {
    this.action = "insert";
    this.insertData = (Array.isArray(values) ? values : [values]).map((v) =>
      structuredClone(v),
    ) as T[];
    return this;
  }

  update(values: Row) {
    this.action = "update";
    this.patchData = structuredClone(values) as Partial<T>;
    return this;
  }

  eq(column: string, value: unknown) {
    this.eqFilters.push({ column, value });
    return this;
  }

  or(filter: string) {
    this.orFilter = filter;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderByCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  single() { return this.run({ single: true }); }
  maybeSingle() { return this.run({ maybeSingle: true }); }
  then<R1, R2 = never>(
    res?: ((v: { data: T | T[] | null; error: null }) => R1 | PromiseLike<R1>) | null,
    rej?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ) {
    return this.run({}).then(res, rej);
  }

  private async run(opts: { single?: boolean; maybeSingle?: boolean }) {
    const rows = this.tables[this.tableName] as T[];

    const matches = rows.filter((row) =>
      this.eqFilters.every(({ column, value }) => row[column] === value),
    );

    let data: T | T[] | null;

    if (this.action === "insert") {
      for (const row of this.insertData) {
        rows.push(structuredClone(row));
      }
      data = this.insertData.length === 1
        ? structuredClone(this.insertData[0])
        : structuredClone(this.insertData);
    } else if (this.action === "update") {
      const updated = matches.map((row) => Object.assign(row, structuredClone(this.patchData)));
      data = updated.length === 1 ? structuredClone(updated[0]) : structuredClone(updated);
    } else {
      let selected = this.orFilter
        ? rows.filter((row) => {
            const q = this.orFilter.match(/ilike\.%([^%]+)%/);
            const keyword = q ? q[1] : "";
            return (
              String(row["name"] ?? "").toLowerCase().includes(keyword.toLowerCase()) ||
              String(row["address"] ?? "").toLowerCase().includes(keyword.toLowerCase()) ||
              String(row["contractor"] ?? "").toLowerCase().includes(keyword.toLowerCase())
            );
          })
        : matches;

      if (this.orderByCol) {
        selected = [...selected].sort((a, b) => {
          const av = a[this.orderByCol];
          const bv = b[this.orderByCol];
          if (av === bv) return 0;
          return (av ?? "") < (bv ?? "")
            ? (this.orderAsc ? -1 : 1)
            : (this.orderAsc ? 1 : -1);
        });
      }
      data = selected.map((r) => structuredClone(r));
    }

    if (opts.single || opts.maybeSingle) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }
    return { data, error: null };
  }
}

function mockClient(initial: Partial<Tables> = {}): SupabaseClient {
  const tables: Tables = {
    projects: structuredClone(initial.projects ?? []),
    tasks: structuredClone(initial.tasks ?? []),
  };
  return {
    from: (table: string) => new MockQueryBuilder(tables, table),
  } as unknown as SupabaseClient;
}

const sampleProject: ProjectRow = {
  id: "p1",
  name: "南青山リノベ",
  contractor: "ラポルタ",
  address: "東京都港区南青山",
  status: "active",
  description: "内装工事",
  start_date: "2025-01-01",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const sampleTask: TaskRow = {
  id: "t1",
  project_id: "p1",
  name: "床工事",
  description: "リノリウム張り",
  status: "todo",
  progress: 0,
  cost: 500000,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("supabase-tools", () => {
  describe("listProjects", () => {
    it("returns all projects", async () => {
      const db = mockClient({ projects: [sampleProject] });
      const result = await listProjects(db);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("南青山リノベ");
    });

    it("returns empty array when no projects", async () => {
      const db = mockClient();
      const result = await listProjects(db);
      expect(result).toEqual([]);
    });
  });

  describe("getProject", () => {
    it("returns project by id", async () => {
      const db = mockClient({ projects: [sampleProject] });
      const result = await getProject("p1", db);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("p1");
    });

    it("returns null for unknown id", async () => {
      const db = mockClient();
      const result = await getProject("nonexistent", db);
      expect(result).toBeNull();
    });
  });

  describe("createProject", () => {
    it("creates a new project", async () => {
      const db = mockClient();
      const result = await createProject({ name: "新規案件", contractor: "ABC", address: "大阪" }, db);
      expect(result.name).toBe("新規案件");
      expect(result.status).toBe("planning");
      expect(result.description).toBe("");
      expect(result.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("updateProject", () => {
    it("updates an existing project", async () => {
      const db = mockClient({ projects: [{ ...sampleProject }] });
      const result = await updateProject("p1", { status: "completed" }, db);
      expect(result.status).toBe("completed");
    });
  });

  describe("listTasks", () => {
    it("returns tasks for a project", async () => {
      const db = mockClient({ tasks: [sampleTask] });
      const result = await listTasks("p1", db);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("床工事");
    });

    it("returns empty array when project has no tasks", async () => {
      const db = mockClient();
      const result = await listTasks("p99", db);
      expect(result).toEqual([]);
    });
  });

  describe("createTask", () => {
    it("creates a task", async () => {
      const db = mockClient();
      const result = await createTask({ project_id: "p1", name: "電気工事" }, db);
      expect(result.name).toBe("電気工事");
      expect(result.project_id).toBe("p1");
      expect(result.status).toBe("todo");
      expect(result.description).toBe("");
      expect(result.progress).toBe(0);
      expect(result.cost).toBe(0);
    });
  });

  describe("updateTask", () => {
    it("updates a task", async () => {
      const db = mockClient({ tasks: [{ ...sampleTask }] });
      const result = await updateTask("t1", { status: "done", progress: 100 }, db);
      expect(result.status).toBe("done");
      expect(result.progress).toBe(100);
    });
  });

  describe("searchProjects", () => {
    it("finds projects by name", async () => {
      const db = mockClient({ projects: [sampleProject] });
      const result = await searchProjects("南青山", db);
      expect(result).toHaveLength(1);
    });

    it("returns empty array when no match", async () => {
      const db = mockClient({ projects: [sampleProject] });
      const result = await searchProjects("存在しない", db);
      expect(result).toHaveLength(0);
    });
  });
});
