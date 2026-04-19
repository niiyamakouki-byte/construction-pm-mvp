import { describe, it, expect } from "vitest";
import {
  MoodBoardSchema,
  MoodBoardItemSchema,
  MoodBoardCategorySchema,
  SelectionSchema,
  SelectionOptionSchema,
  SelectionCategorySchema,
  SelectionStatusSchema,
  CRMContactSchema,
  CRMDealSchema,
  CRMDealStageSchema,
} from "../schemas.js";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const UUID2 = "223e4567-e89b-12d3-a456-426614174001";
const NOW = new Date().toISOString();

function base() {
  return { id: UUID, createdAt: NOW, updatedAt: NOW };
}

// ── MoodBoardItemSchema ─────────────────────────────────────────────────────

describe("MoodBoardItemSchema", () => {
  const validItem = {
    id: "mbi-1",
    imageUrl: "https://example.com/a.jpg",
    title: "オーク床材",
    description: "天然木突板",
    category: "床" as const,
    supplier: "メーカーA",
    price: 120000,
    position: { x: 10, y: 20 },
    size: { w: 200, h: 150 },
  };

  it("happy path: parses valid item", () => {
    expect(MoodBoardItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("accepts item without optional supplier/price", () => {
    const { supplier: _s, price: _p, ...rest } = validItem;
    void _s; void _p;
    expect(MoodBoardItemSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects invalid image URL", () => {
    expect(
      MoodBoardItemSchema.safeParse({ ...validItem, imageUrl: "not-a-url" }).success,
    ).toBe(false);
  });

  it("rejects negative price", () => {
    expect(MoodBoardItemSchema.safeParse({ ...validItem, price: -100 }).success).toBe(false);
  });

  it("accepts price of 0", () => {
    expect(MoodBoardItemSchema.safeParse({ ...validItem, price: 0 }).success).toBe(true);
  });

  it("rejects invalid category", () => {
    expect(
      MoodBoardItemSchema.safeParse({ ...validItem, category: "unknown" }).success,
    ).toBe(false);
  });

  it("rejects zero/negative width or height", () => {
    expect(
      MoodBoardItemSchema.safeParse({ ...validItem, size: { w: 0, h: 100 } }).success,
    ).toBe(false);
    expect(
      MoodBoardItemSchema.safeParse({ ...validItem, size: { w: 100, h: -1 } }).success,
    ).toBe(false);
  });

  it("rejects non-finite position numbers", () => {
    expect(
      MoodBoardItemSchema.safeParse({ ...validItem, position: { x: Number.NaN, y: 0 } }).success,
    ).toBe(false);
  });
});

describe("MoodBoardCategorySchema", () => {
  it("accepts all 7 valid categories", () => {
    for (const cat of ["床", "壁", "天井", "家具", "照明", "カーテン", "その他"]) {
      expect(MoodBoardCategorySchema.safeParse(cat).success).toBe(true);
    }
  });
});

// ── MoodBoardSchema ──────────────────────────────────────────────────────────

describe("MoodBoardSchema", () => {
  const valid = {
    ...base(),
    projectId: UUID2,
    title: "リビング提案",
    items: [],
  };

  it("happy path: parses valid board", () => {
    expect(MoodBoardSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects non-UUID projectId", () => {
    expect(
      MoodBoardSchema.safeParse({ ...valid, projectId: "proj-1" }).success,
    ).toBe(false);
  });

  it("accepts board with items", () => {
    const item = {
      id: "mbi-1",
      imageUrl: "https://example.com/a.jpg",
      title: "床",
      description: "",
      category: "床" as const,
      position: { x: 0, y: 0 },
      size: { w: 100, h: 100 },
    };
    expect(MoodBoardSchema.safeParse({ ...valid, items: [item] }).success).toBe(true);
  });
});

// ── SelectionOptionSchema ────────────────────────────────────────────────────

describe("SelectionOptionSchema", () => {
  const valid = {
    id: "opt-1",
    name: "オーク",
    description: "15mm",
    unitPrice: 12000,
  };

  it("happy path", () => {
    expect(SelectionOptionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative unitPrice", () => {
    expect(SelectionOptionSchema.safeParse({ ...valid, unitPrice: -1 }).success).toBe(false);
  });

  it("accepts optional imageUrl/catalogUrl when URL-valid", () => {
    expect(
      SelectionOptionSchema.safeParse({
        ...valid,
        imageUrl: "https://x/a.jpg",
        catalogUrl: "https://x/cat",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid imageUrl", () => {
    expect(
      SelectionOptionSchema.safeParse({ ...valid, imageUrl: "not-url" }).success,
    ).toBe(false);
  });
});

// ── SelectionSchema ──────────────────────────────────────────────────────────

describe("SelectionSchema", () => {
  const valid = {
    ...base(),
    projectId: UUID2,
    category: "床材" as const,
    name: "リビング床材",
    options: [{ id: "opt-1", name: "A", description: "desc", unitPrice: 1000 }],
    selectedOptionId: null,
    status: "選定中" as const,
    clientNote: "",
  };

  it("happy path: parses valid selection", () => {
    expect(SelectionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts selectedOptionId null or string", () => {
    expect(SelectionSchema.safeParse({ ...valid, selectedOptionId: null }).success).toBe(true);
    expect(SelectionSchema.safeParse({ ...valid, selectedOptionId: "opt-1" }).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(
      SelectionSchema.safeParse({ ...valid, status: "不明" }).success,
    ).toBe(false);
  });

  it("accepts all 4 valid statuses", () => {
    for (const s of ["選定中", "施主確認待ち", "承認済", "変更依頼"]) {
      expect(SelectionStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("accepts all 7 valid categories", () => {
    for (const c of ["床材", "壁材", "天井材", "建具", "照明", "衛生器具", "その他"]) {
      expect(SelectionCategorySchema.safeParse(c).success).toBe(true);
    }
  });
});

// ── CRMContactSchema ─────────────────────────────────────────────────────────

describe("CRMContactSchema", () => {
  const valid = {
    ...base(),
    name: "田中太郎",
    company: "田中建設",
    phone: "03-1234-5678",
    email: "t@example.com",
    address: "東京都港区",
    note: "",
  };

  it("happy path", () => {
    expect(CRMContactSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects non-UUID id", () => {
    expect(CRMContactSchema.safeParse({ ...valid, id: "c-1" }).success).toBe(false);
  });

  it("rejects missing name field", () => {
    const { name: _n, ...rest } = valid;
    void _n;
    expect(CRMContactSchema.safeParse(rest).success).toBe(false);
  });
});

// ── CRMDealSchema ────────────────────────────────────────────────────────────

describe("CRMDealSchema", () => {
  const valid = {
    ...base(),
    customerId: UUID2,
    projectName: "南青山内装",
    stage: "商談中" as const,
    estimatedAmount: 4750000,
    actualAmount: null,
    probability: 70,
    expectedCloseDate: "2025-07-31",
    note: "",
  };

  it("happy path", () => {
    expect(CRMDealSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all 6 valid stages", () => {
    for (const s of ["引合", "現調", "見積提出", "商談中", "受注", "失注"]) {
      expect(CRMDealStageSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects unknown stage", () => {
    expect(CRMDealSchema.safeParse({ ...valid, stage: "unknown" }).success).toBe(false);
  });

  it("rejects negative estimatedAmount", () => {
    expect(CRMDealSchema.safeParse({ ...valid, estimatedAmount: -1 }).success).toBe(false);
  });

  it("accepts actualAmount null or non-negative number", () => {
    expect(CRMDealSchema.safeParse({ ...valid, actualAmount: null }).success).toBe(true);
    expect(CRMDealSchema.safeParse({ ...valid, actualAmount: 0 }).success).toBe(true);
    expect(CRMDealSchema.safeParse({ ...valid, actualAmount: 2950000 }).success).toBe(true);
  });

  it("rejects probability > 100", () => {
    expect(CRMDealSchema.safeParse({ ...valid, probability: 101 }).success).toBe(false);
  });

  it("rejects probability < 0", () => {
    expect(CRMDealSchema.safeParse({ ...valid, probability: -1 }).success).toBe(false);
  });

  it("accepts probability 0 and 100", () => {
    expect(CRMDealSchema.safeParse({ ...valid, probability: 0 }).success).toBe(true);
    expect(CRMDealSchema.safeParse({ ...valid, probability: 100 }).success).toBe(true);
  });

  it("rejects non-UUID customerId", () => {
    expect(CRMDealSchema.safeParse({ ...valid, customerId: "c-1" }).success).toBe(false);
  });
});
