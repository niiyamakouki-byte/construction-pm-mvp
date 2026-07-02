import { describe, it, expect, vi } from "vitest";
import {
  ProjectSchema,
  ProjectModeSchema,
  TaskSchema,
  CostItemSchema,
  InvoiceSchema,
  ContractSchema,
  ChangeOrderSchema,
  PhotoSchema,
  SchemaValidationError,
  parseOrThrow,
  parseOrWarn,
} from "../schemas.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const UUID2 = "223e4567-e89b-12d3-a456-426614174001";
const NOW = new Date().toISOString(); // full datetime e.g. "2025-04-19T00:00:00.000Z"
const DATE = "2025-04-01";           // date-only format

function base() {
  return { id: UUID, createdAt: NOW, updatedAt: NOW };
}

// ── parseOrThrow ──────────────────────────────────────────────────────────────

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    const project = {
      ...base(),
      name: "Test",
      description: "",
      status: "planning" as const,
      startDate: DATE,
      includeWeekends: false,
    };
    const result = parseOrThrow(ProjectSchema, "Project", project);
    expect(result.name).toBe("Test");
  });

  it("throws SchemaValidationError on failure", () => {
    expect(() =>
      parseOrThrow(ProjectSchema, "Project", { bad: "data" }),
    ).toThrow(SchemaValidationError);
  });

  it("SchemaValidationError has entityName and cause", () => {
    try {
      parseOrThrow(ProjectSchema, "Project", {});
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      const sve = err as SchemaValidationError;
      expect(sve.entityName).toBe("Project");
      expect(sve.cause).toBeDefined();
    }
  });
});

// ── ProjectSchema ─────────────────────────────────────────────────────────────

describe("ProjectSchema", () => {
  const validProject = {
    ...base(),
    name: "南青山内装工事",
    description: "説明",
    status: "active" as const,
    startDate: DATE,
    includeWeekends: true,
  };

  it("happy path: parses a valid project", () => {
    const result = ProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });

  it("defaults legacy projects without mode to normal", () => {
    const result = ProjectSchema.parse(validProject);
    expect(result.mode).toBe("normal");
  });

  it("accepts project modes", () => {
    for (const mode of ["memo", "normal", "full"] as const) {
      expect(ProjectModeSchema.safeParse(mode).success).toBe(true);
      expect(ProjectSchema.safeParse({ ...validProject, mode }).success).toBe(true);
    }
  });

  it("happy path: accepts full ISO datetime for startDate", () => {
    const result = ProjectSchema.safeParse({ ...validProject, startDate: NOW });
    expect(result.success).toBe(true);
  });

  it("accepts optional fields: endDate, budget, address, lat/lon", () => {
    const result = ProjectSchema.safeParse({
      ...validProject,
      endDate: "2025-12-31",
      budget: 10000000,
      address: "東京都港区南青山",
      latitude: 35.67,
      longitude: 139.71,
    });
    expect(result.success).toBe(true);
  });

  it("edge: rejects non-UUID id", () => {
    const result = ProjectSchema.safeParse({ ...validProject, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid date string for startDate", () => {
    const result = ProjectSchema.safeParse({ ...validProject, startDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid status value", () => {
    const result = ProjectSchema.safeParse({ ...validProject, status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects Infinity for budget", () => {
    const result = ProjectSchema.safeParse({ ...validProject, budget: Infinity });
    expect(result.success).toBe(false);
  });

  it("edge: rejects NaN for latitude", () => {
    const result = ProjectSchema.safeParse({ ...validProject, latitude: NaN });
    expect(result.success).toBe(false);
  });
});

// ── TaskSchema ────────────────────────────────────────────────────────────────

describe("TaskSchema", () => {
  const validTask = {
    ...base(),
    projectId: UUID,
    name: "LGS工事",
    description: "",
    status: "todo" as const,
    progress: 0,
    dependencies: [],
  };

  it("happy path: parses a valid task", () => {
    const result = TaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it("accepts optional startDate as date-only string", () => {
    const result = TaskSchema.safeParse({ ...validTask, startDate: DATE });
    expect(result.success).toBe(true);
  });

  it("accepts all dependency types", () => {
    for (const dt of ["FS", "FF", "SS", "SF", "none"] as const) {
      const result = TaskSchema.safeParse({ ...validTask, dependencyType: dt });
      expect(result.success).toBe(true);
    }
  });

  it("edge: rejects non-UUID projectId", () => {
    const result = TaskSchema.safeParse({ ...validTask, projectId: "p-1" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects NaN for progress", () => {
    const result = TaskSchema.safeParse({ ...validTask, progress: NaN });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid date for dueDate", () => {
    const result = TaskSchema.safeParse({ ...validTask, dueDate: "2025-13-99" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid dependencyType", () => {
    const result = TaskSchema.safeParse({ ...validTask, dependencyType: "XY" });
    expect(result.success).toBe(false);
  });
});

// ── CostItemSchema ────────────────────────────────────────────────────────────

describe("CostItemSchema", () => {
  const validCostItem = {
    ...base(),
    projectId: UUID,
    description: "材料費",
    amount: 150000,
    category: "材料",
  };

  it("happy path: parses a valid cost item", () => {
    const result = CostItemSchema.safeParse(validCostItem);
    expect(result.success).toBe(true);
  });

  it("allows negative amount (returns/discounts)", () => {
    const result = CostItemSchema.safeParse({ ...validCostItem, amount: -5000 });
    expect(result.success).toBe(true);
  });

  it("edge: rejects NaN for amount", () => {
    const result = CostItemSchema.safeParse({ ...validCostItem, amount: NaN });
    expect(result.success).toBe(false);
  });

  it("edge: rejects Infinity for amount", () => {
    const result = CostItemSchema.safeParse({ ...validCostItem, amount: Infinity });
    expect(result.success).toBe(false);
  });

  it("edge: rejects non-UUID projectId", () => {
    const result = CostItemSchema.safeParse({ ...validCostItem, projectId: "proj-123" });
    expect(result.success).toBe(false);
  });

  it("accepts all breakdown types", () => {
    for (const bt of ["task_cost", "material_cost", "change_order_cost", "invoice_received"] as const) {
      const result = CostItemSchema.safeParse({ ...validCostItem, breakdownType: bt });
      expect(result.success).toBe(true);
    }
  });

  it("accepts both payment statuses", () => {
    for (const ps of ["paid", "unpaid"] as const) {
      const result = CostItemSchema.safeParse({ ...validCostItem, paymentStatus: ps });
      expect(result.success).toBe(true);
    }
  });
});

// ── InvoiceSchema ─────────────────────────────────────────────────────────────

describe("InvoiceSchema", () => {
  const validInvoice = {
    ...base(),
    projectId: UUID,
    invoiceNumber: "INV-2025-001",
    amount: 500000,
    status: "draft" as const,
    issueDate: DATE,
    dueDate: "2025-05-01",
  };

  it("happy path: parses a valid invoice", () => {
    const result = InvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it("edge: rejects Infinity for amount", () => {
    const result = InvoiceSchema.safeParse({ ...validInvoice, amount: Infinity });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid status", () => {
    const result = InvoiceSchema.safeParse({ ...validInvoice, status: "approved" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid date for dueDate", () => {
    const result = InvoiceSchema.safeParse({ ...validInvoice, dueDate: "bad-date" });
    expect(result.success).toBe(false);
  });
});

// ── ContractSchema ────────────────────────────────────────────────────────────

describe("ContractSchema", () => {
  const validContract = {
    ...base(),
    projectId: UUID,
    contractorId: UUID2,
    title: "LGS工事契約",
    amount: 2000000,
    status: "active" as const,
    startDate: DATE,
  };

  it("happy path: parses a valid contract", () => {
    const result = ContractSchema.safeParse(validContract);
    expect(result.success).toBe(true);
  });

  it("edge: rejects non-UUID contractorId", () => {
    const result = ContractSchema.safeParse({ ...validContract, contractorId: "c-1" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects NaN for amount", () => {
    const result = ContractSchema.safeParse({ ...validContract, amount: NaN });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid status", () => {
    const result = ContractSchema.safeParse({ ...validContract, status: "pending" });
    expect(result.success).toBe(false);
  });
});

// ── ChangeOrderSchema ─────────────────────────────────────────────────────────

describe("ChangeOrderSchema", () => {
  const validChangeOrder = {
    ...base(),
    projectId: UUID,
    title: "追加工事",
    description: "壁面追加",
    amount: 300000,
    status: "pending" as const,
    requestDate: DATE,
  };

  it("happy path: parses a valid change order", () => {
    const result = ChangeOrderSchema.safeParse(validChangeOrder);
    expect(result.success).toBe(true);
  });

  it("edge: rejects NaN for amount", () => {
    const result = ChangeOrderSchema.safeParse({ ...validChangeOrder, amount: NaN });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid requestDate format", () => {
    const result = ChangeOrderSchema.safeParse({ ...validChangeOrder, requestDate: "Apr 1 2025" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects non-UUID projectId", () => {
    const result = ChangeOrderSchema.safeParse({ ...validChangeOrder, projectId: "not-uuid" });
    expect(result.success).toBe(false);
  });
});

// ── PhotoSchema ───────────────────────────────────────────────────────────────

describe("PhotoSchema", () => {
  const validPhoto = {
    ...base(),
    projectId: UUID,
    url: "https://example.com/photo.jpg",
  };

  it("happy path: parses a valid photo", () => {
    const result = PhotoSchema.safeParse(validPhoto);
    expect(result.success).toBe(true);
  });

  it("accepts optional takenAt as date-only string", () => {
    const result = PhotoSchema.safeParse({ ...validPhoto, takenAt: DATE });
    expect(result.success).toBe(true);
  });

  it("edge: rejects invalid URL", () => {
    const result = PhotoSchema.safeParse({ ...validPhoto, url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects non-UUID projectId", () => {
    const result = PhotoSchema.safeParse({ ...validPhoto, projectId: "proj-x" });
    expect(result.success).toBe(false);
  });

  it("edge: rejects invalid takenAt format", () => {
    const result = PhotoSchema.safeParse({ ...validPhoto, takenAt: "01/04/2025" });
    expect(result.success).toBe(false);
  });
});

// ── Null-value DB compatibility (parseOrWarn path) ────────────────────────────
// DB returns null for nullable columns; schemas must accept null without warning.

describe("DB null values — no schema validation warnings", () => {
  it("ProjectSchema accepts null for all nullable DB columns", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = {
      ...base(),
      name: "南青山工事",
      description: "",
      status: "active" as const,
      startDate: DATE,
      includeWeekends: true,
      // Supabase returns null for nullable columns
      endDate: null,
      address: null,
      latitude: null,
      longitude: null,
      budget: null,
    };
    parseOrWarn(ProjectSchema, "Project", data);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("TaskSchema accepts null for all nullable DB columns", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = {
      ...base(),
      projectId: UUID,
      name: "LGS工事",
      description: "",
      status: "todo" as const,
      progress: 0,
      dependencies: [],
      // Supabase returns null for nullable columns
      includeWeekends: null,
      assigneeId: null,
      startDate: null,
      dueDate: null,
      dependencyType: null,
      contractorId: null,
      materials: null,
      lead_time: null,
      leadTimeDays: null,
      canvasX: null,
      canvasY: null,
      majorCategory: null,
      middleCategory: null,
      minorCategory: null,
      sortIndex: null,
    };
    parseOrWarn(TaskSchema, "Task", data);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("CostItemSchema accepts null for all nullable DB columns", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = {
      ...base(),
      projectId: UUID,
      description: "材料費",
      amount: 50000,
      category: "材料",
      // Supabase returns null for nullable columns
      taskId: null,
      costDate: null,
      paymentStatus: null,
      breakdownType: null,
    };
    parseOrWarn(CostItemSchema, "CostItem", data);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
