/**
 * deal_mapper.ts テスト
 */

import { describe, it, expect } from "vitest";
import {
  mapProjectToDeal,
  resolveAccountItem,
  inferExpenseCategory,
  ACCOUNT_ITEMS,
} from "../deal_mapper.js";
import type { Project } from "../../../domain/types.js";

// ── フィクスチャ ─────────────────────────────────────

const baseProject: Project = {
  id: "proj-101",
  name: "KDX南青山リノベーション",
  description: "内装工事一式",
  status: "active",
  startDate: "2026-04-01",
  endDate: "2026-09-30",
  budget: 9_460_000,
  includeWeekends: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// ── inferExpenseCategory ─────────────────────────────

describe("inferExpenseCategory", () => {
  it("外注系キーワードで subcontract", () => {
    expect(inferExpenseCategory("外注費")).toBe("subcontract");
    expect(inferExpenseCategory("下請業者費用")).toBe("subcontract");
    expect(inferExpenseCategory("協力業者代金")).toBe("subcontract");
  });

  it("材料系キーワードで material", () => {
    expect(inferExpenseCategory("材料費")).toBe("material");
    expect(inferExpenseCategory("資材購入")).toBe("material");
    expect(inferExpenseCategory("仕入代金")).toBe("material");
  });

  it("労務系キーワードで labor", () => {
    expect(inferExpenseCategory("人件費")).toBe("labor");
    expect(inferExpenseCategory("労務費")).toBe("labor");
    expect(inferExpenseCategory("給与支払")).toBe("labor");
  });

  it("不明なキーワードで general", () => {
    expect(inferExpenseCategory("工事費")).toBe("general");
    expect(inferExpenseCategory("内装工事")).toBe("general");
  });
});

// ── resolveAccountItem ───────────────────────────────

describe("resolveAccountItem", () => {
  it("income → 売上高 (id=1) + 消費税 10%", () => {
    const { accountItemId, taxCode } = resolveAccountItem("income", "内装工事");
    expect(accountItemId).toBe(ACCOUNT_ITEMS.SALES);
    expect(taxCode).toBe(21);
  });

  it("expense + 外注 → 外注費 (id=502)", () => {
    const { accountItemId } = resolveAccountItem("expense", "外注費");
    expect(accountItemId).toBe(ACCOUNT_ITEMS.SUBCONTRACT);
  });

  it("expense + 材料 → 材料費 (id=503)", () => {
    const { accountItemId } = resolveAccountItem("expense", "材料購入");
    expect(accountItemId).toBe(ACCOUNT_ITEMS.MATERIAL);
  });

  it("expense + 人件費 → 労務費 (id=504) + 非課税 (0)", () => {
    const { accountItemId, taxCode } = resolveAccountItem("expense", "人件費");
    expect(accountItemId).toBe(ACCOUNT_ITEMS.LABOR);
    expect(taxCode).toBe(0);
  });

  it("expense + 不明 → 工事原価 (id=501)", () => {
    const { accountItemId } = resolveAccountItem("expense", "工事一式");
    expect(accountItemId).toBe(ACCOUNT_ITEMS.CONSTRUCTION_COST);
  });
});

// ── mapProjectToDeal ─────────────────────────────────

describe("mapProjectToDeal — income (デフォルト)", () => {
  it("基本フィールドが正しく変換される", () => {
    const deal = mapProjectToDeal(baseProject);
    expect(deal.issue_date).toBe("2026-04-01");
    expect(deal.due_date).toBe("2026-09-30");
    expect(deal.amount).toBe(9_460_000);
    expect(deal.type).toBe("income");
    expect(deal.ref_number).toBe("proj-101");
  });

  it("details が 1 件で account_item_id=1 (売上高)", () => {
    const deal = mapProjectToDeal(baseProject);
    expect(deal.details).toHaveLength(1);
    expect(deal.details[0].account_item_id).toBe(ACCOUNT_ITEMS.SALES);
    expect(deal.details[0].amount).toBe(9_460_000);
    expect(deal.details[0].description).toBe("KDX南青山リノベーション");
  });
});

describe("mapProjectToDeal — expense", () => {
  it("type=expense で工事原価に変換される", () => {
    const deal = mapProjectToDeal(baseProject, { type: "expense" });
    expect(deal.type).toBe("expense");
    expect(deal.details[0].account_item_id).toBe(ACCOUNT_ITEMS.CONSTRUCTION_COST);
  });

  it("外注費案件は外注費勘定科目", () => {
    const project: Project = { ...baseProject, name: "外注費 A社" };
    const deal = mapProjectToDeal(project, { type: "expense" });
    expect(deal.details[0].account_item_id).toBe(ACCOUNT_ITEMS.SUBCONTRACT);
  });
});

describe("mapProjectToDeal — オプション", () => {
  it("partnerId が指定されれば partner_id に入る", () => {
    const deal = mapProjectToDeal(baseProject, { partnerId: 999 });
    expect(deal.partner_id).toBe(999);
  });

  it("issueDate / dueDate を上書きできる", () => {
    const deal = mapProjectToDeal(baseProject, {
      issueDate: "2026-05-01",
      dueDate: "2026-10-31",
    });
    expect(deal.issue_date).toBe("2026-05-01");
    expect(deal.due_date).toBe("2026-10-31");
  });

  it("budget が 0 の場合は amount=0", () => {
    const project: Project = { ...baseProject, budget: 0 };
    const deal = mapProjectToDeal(project);
    expect(deal.amount).toBe(0);
  });

  it("budget が undefined の場合は amount=0", () => {
    const project: Project = { ...baseProject, budget: undefined };
    const deal = mapProjectToDeal(project);
    expect(deal.amount).toBe(0);
  });
});
