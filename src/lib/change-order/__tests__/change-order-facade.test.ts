/**
 * change-order-facade unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createChangeOrder,
  runImpactAnalysis,
  isDangerousImpact,
  markEstimatingComplete,
  recordOwnerApproval,
  recordSupervisorApproval,
  recordExecutiveApproval,
  generateChangeOrderDocument,
  listProjectChangeOrders,
  listChangeOrdersByStatus,
  listRecentChangeOrders,
  getChangeOrder,
} from "../change-order-facade.js";
import { _resetChangeOrderStore } from "../change-order-store.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

beforeEach(() => {
  localStorage.clear();
  _resetChangeOrderStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("createChangeOrder", () => {
  it("新しい変更指示を作成して返す", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "addition",
      descriptionJa: "バルコニー手すり追加",
      requestedBy: "田中様",
    });

    expect(co.id).toBeDefined();
    expect(co.projectId).toBe("proj-001");
    expect(co.kind).toBe("addition");
    expect(co.status).toBe("requested");
    expect(co.approvalRecords).toEqual([]);
  });

  it("targetWorkItem をセットできる", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "materialUpgrade",
      descriptionJa: "フローリング変更",
      requestedBy: "田中様",
      targetWorkItem: "床工事",
    });
    expect(co.targetWorkItem).toBe("床工事");
  });

  it("ストアに保存される", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "modification",
      descriptionJa: "壁紙変更",
      requestedBy: "鈴木様",
    });
    const found = getChangeOrder(co.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(co.id);
  });
});

describe("runImpactAnalysis", () => {
  it("影響分析を実行してストアに保存する", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "modification",
      descriptionJa: "壁仕上げ変更",
      requestedBy: "田中様",
      relatedPhaseIds: ["wall_finish"],
    });

    const updated = runImpactAnalysis(co.id, {
      originalLines: [{ id: "l1", trade: "大工", descriptionJa: "壁", unitPriceJpy: 10000, quantity: 10, unit: "m2" }],
      newLines: [{ id: "l2", trade: "大工", descriptionJa: "壁(変更)", unitPriceJpy: 15000, quantity: 10, unit: "m2" }],
      phases: [],
      baseContractJpy: 500_000,
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("estimating");
    expect(updated?.impactAnalysis).toBeDefined();
    expect(updated?.impactAnalysis?.costDeltaJpy).toBe(50_000);
  });

  it("存在しないIDでは null を返す", () => {
    const result = runImpactAnalysis("nonexistent", {
      originalLines: [],
      newLines: [],
      phases: [],
      baseContractJpy: 0,
    });
    expect(result).toBeNull();
  });

  it("依存チェーンが設定される (wall_finish -> downstream)", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "modification",
      descriptionJa: "壁仕上げ変更",
      requestedBy: "田中様",
      relatedPhaseIds: ["wall_finish"],
    });

    const updated = runImpactAnalysis(co.id, {
      originalLines: [],
      newLines: [],
      phases: [],
      baseContractJpy: 1_000_000,
    });

    expect(updated?.impactAnalysis?.dependencyChain.length).toBeGreaterThan(0);
  });
});

describe("isDangerousImpact re-export", () => {
  it("10%以上で true", () => {
    expect(isDangerousImpact({
      costDeltaJpy: 100_000,
      scheduleDeltaDays: 1,
      affectedTrades: [],
      dependencyChain: [],
      costIncreaseRatioPct: 10,
    })).toBe(true);
  });
});

describe("generateChangeOrderDocument", () => {
  it("markdown ドキュメントを生成する", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "addition",
      descriptionJa: "追加工事",
      requestedBy: "田中様",
    });

    const doc = generateChangeOrderDocument(co.id, "markdown");
    expect(doc).not.toBeNull();
    expect(doc).toContain("変更指示書");
  });

  it("html ドキュメントを生成する", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "addition",
      descriptionJa: "追加工事",
      requestedBy: "田中様",
    });

    const doc = generateChangeOrderDocument(co.id, "html");
    expect(doc).toContain("<!DOCTYPE html>");
  });

  it("存在しないIDでは null を返す", () => {
    expect(generateChangeOrderDocument("nonexistent", "markdown")).toBeNull();
  });
});

describe("listProjectChangeOrders", () => {
  it("プロジェクトIDでフィルタリングできる", () => {
    createChangeOrder({ projectId: "proj-A", kind: "addition", descriptionJa: "A", requestedBy: "田中様" });
    createChangeOrder({ projectId: "proj-B", kind: "modification", descriptionJa: "B", requestedBy: "鈴木様" });

    expect(listProjectChangeOrders("proj-A")).toHaveLength(1);
    expect(listProjectChangeOrders("proj-B")).toHaveLength(1);
    expect(listProjectChangeOrders("proj-C")).toHaveLength(0);
  });
});

describe("listChangeOrdersByStatus", () => {
  it("ステータスでフィルタリングできる", () => {
    createChangeOrder({ projectId: "proj-001", kind: "addition", descriptionJa: "追加", requestedBy: "田中様" });
    expect(listChangeOrdersByStatus("requested")).toHaveLength(1);
    expect(listChangeOrdersByStatus("approved")).toHaveLength(0);
  });
});

describe("listRecentChangeOrders", () => {
  it("最近の変更指示を返す", () => {
    for (let i = 0; i < 5; i++) {
      createChangeOrder({ projectId: "proj-001", kind: "addition", descriptionJa: `追加${i}`, requestedBy: "田中様" });
    }
    expect(listRecentChangeOrders(3)).toHaveLength(3);
    expect(listRecentChangeOrders(10)).toHaveLength(5);
  });
});

describe("approval flow via facade", () => {
  it("フル承認フローが通る", () => {
    const co = createChangeOrder({
      projectId: "proj-001",
      kind: "modification",
      descriptionJa: "壁紙変更",
      requestedBy: "田中様",
    });

    const afterImpact = runImpactAnalysis(co.id, {
      originalLines: [],
      newLines: [],
      phases: [],
      baseContractJpy: 1_000_000,
    });
    expect(afterImpact?.status).toBe("estimating");

    const afterEst = markEstimatingComplete(co.id);
    expect(afterEst?.status).toBe("ownerApproval");

    const afterOwner = recordOwnerApproval(co.id, "田中様", "approved");
    expect(afterOwner?.status).toBe("supervisorApproval");

    const afterSup = recordSupervisorApproval(co.id, "現場監督", "approved");
    expect(afterSup?.status).toBe("executiveApproval");

    const afterExec = recordExecutiveApproval(co.id, "新山", "approved");
    expect(afterExec?.status).toBe("approved");
    expect(afterExec?.approvedAt).toBeDefined();
  });
});
