import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  createChangeRequest,
  getChangeRequests,
  getChangeRequestById,
  updateChangeRequest,
  clearChangeRequests,
  transitionStatus,
  getApprovedCostTotal,
  type ChangeRequest,
} from "./change-request.js";

function makeParams(
  overrides: Partial<Omit<ChangeRequest, "costDifference" | "status" | "createdAt">> = {},
): Omit<ChangeRequest, "costDifference" | "status" | "createdAt"> {
  return {
    id: "cr-1",
    projectId: "proj-1",
    requestedBy: "施主",
    description: "キッチン変更",
    impactDescription: "キャビネット材変更",
    originalEstimate: 500000,
    revisedEstimate: 650000,
    ...overrides,
  };
}

describe("change-request", () => {
  beforeEach(() => {
    clearChangeRequests();
  });

  describe("createChangeRequest", () => {
    it("costDifference を自動計算する", () => {
      const req = createChangeRequest(makeParams());
      expect(req.costDifference).toBe(150000);
    });

    it("初期ステータスは申請中", () => {
      const req = createChangeRequest(makeParams());
      expect(req.status).toBe("申請中");
    });

    it("createdAt を自動セットする", () => {
      const req = createChangeRequest(makeParams());
      expect(req.createdAt).toBeTruthy();
    });

    it("マイナス差額（コスト削減）を正しく計算する", () => {
      const req = createChangeRequest(makeParams({ originalEstimate: 600000, revisedEstimate: 400000 }));
      expect(req.costDifference).toBe(-200000);
    });

    it("元オブジェクトを変更してもストアに影響しない", () => {
      const params = makeParams();
      const req = createChangeRequest(params);
      req.description = "Mutated";
      expect(getChangeRequests()[0]!.description).toBe("キッチン変更");
    });
  });

  describe("getChangeRequests", () => {
    it("projectId でフィルタリングできる", () => {
      createChangeRequest(makeParams({ id: "cr-1", projectId: "proj-1" }));
      createChangeRequest(makeParams({ id: "cr-2", projectId: "proj-2" }));
      const result = getChangeRequests("proj-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("cr-1");
    });

    it("引数なしで全件返す", () => {
      createChangeRequest(makeParams({ id: "cr-1" }));
      createChangeRequest(makeParams({ id: "cr-2" }));
      expect(getChangeRequests()).toHaveLength(2);
    });
  });

  describe("getChangeRequestById", () => {
    it("存在するIDを返す", () => {
      createChangeRequest(makeParams({ id: "cr-1" }));
      expect(getChangeRequestById("cr-1")?.id).toBe("cr-1");
    });

    it("存在しないIDはundefined", () => {
      expect(getChangeRequestById("cr-999")).toBeUndefined();
    });
  });

  describe("updateChangeRequest", () => {
    it("説明を更新できる", () => {
      createChangeRequest(makeParams());
      const updated = updateChangeRequest("cr-1", { description: "床材変更" });
      expect(updated.description).toBe("床材変更");
    });

    it("見積変更時にcostDifferenceを再計算する", () => {
      createChangeRequest(makeParams({ originalEstimate: 500000, revisedEstimate: 600000 }));
      const updated = updateChangeRequest("cr-1", { revisedEstimate: 700000 });
      expect(updated.costDifference).toBe(200000);
    });

    it("originalEstimateのみ変更時にも再計算する", () => {
      createChangeRequest(makeParams({ originalEstimate: 500000, revisedEstimate: 650000 }));
      const updated = updateChangeRequest("cr-1", { originalEstimate: 400000 });
      expect(updated.costDifference).toBe(250000);
    });

    it("存在しないIDはエラー", () => {
      expect(() => updateChangeRequest("cr-999", {})).toThrow("cr-999 not found");
    });
  });

  describe("transitionStatus", () => {
    it("申請中 → 見積中 の遷移", () => {
      createChangeRequest(makeParams());
      const { request } = transitionStatus("cr-1", "見積中");
      expect(request.status).toBe("見積中");
    });

    it("見積中 → 施主確認中 → 承認済 の遷移", () => {
      createChangeRequest(makeParams());
      transitionStatus("cr-1", "見積中");
      transitionStatus("cr-1", "施主確認中");
      const { request } = transitionStatus("cr-1", "承認済");
      expect(request.status).toBe("承認済");
      expect(request.approvedAt).toBeTruthy();
    });

    it("承認済 → 実施済 の遷移", () => {
      createChangeRequest(makeParams());
      transitionStatus("cr-1", "見積中");
      transitionStatus("cr-1", "施主確認中");
      transitionStatus("cr-1", "承認済");
      const { request } = transitionStatus("cr-1", "実施済");
      expect(request.status).toBe("実施済");
    });

    it("不正な遷移はエラー", () => {
      createChangeRequest(makeParams());
      expect(() => transitionStatus("cr-1", "承認済")).toThrow("ステータス遷移不可");
    });

    it("却下後の遷移はエラー", () => {
      createChangeRequest(makeParams());
      transitionStatus("cr-1", "却下");
      expect(() => transitionStatus("cr-1", "見積中")).toThrow("ステータス遷移不可");
    });

    it("承認済遷移時に budgetEntries を返す", () => {
      createChangeRequest(makeParams({ originalEstimate: 500000, revisedEstimate: 650000 }));
      transitionStatus("cr-1", "見積中");
      transitionStatus("cr-1", "施主確認中");
      const { budgetEntries } = transitionStatus("cr-1", "承認済");
      expect(budgetEntries.length).toBeGreaterThan(0);
    });

    it("差額ゼロの承認は budgetEntries 空", () => {
      createChangeRequest(makeParams({ originalEstimate: 500000, revisedEstimate: 500000 }));
      transitionStatus("cr-1", "見積中");
      transitionStatus("cr-1", "施主確認中");
      const { budgetEntries } = transitionStatus("cr-1", "承認済");
      expect(budgetEntries).toHaveLength(0);
    });

    it("存在しないIDはエラー", () => {
      expect(() => transitionStatus("cr-999", "見積中")).toThrow("cr-999 not found");
    });
  });

  describe("getApprovedCostTotal", () => {
    it("承認済・実施済の合計を返す", () => {
      createChangeRequest(makeParams({ id: "cr-1", originalEstimate: 500000, revisedEstimate: 600000 }));
      createChangeRequest(makeParams({ id: "cr-2", originalEstimate: 300000, revisedEstimate: 350000 }));
      createChangeRequest(makeParams({ id: "cr-3", originalEstimate: 200000, revisedEstimate: 280000 }));

      // cr-1: 承認済
      transitionStatus("cr-1", "見積中");
      transitionStatus("cr-1", "施主確認中");
      transitionStatus("cr-1", "承認済");

      // cr-2: 実施済
      transitionStatus("cr-2", "見積中");
      transitionStatus("cr-2", "施主確認中");
      transitionStatus("cr-2", "承認済");
      transitionStatus("cr-2", "実施済");

      // cr-3: 申請中のまま → 対象外

      const total = getApprovedCostTotal("proj-1");
      expect(total).toBe(150000); // 100000 + 50000
    });

    it("対象案件なしは0", () => {
      expect(getApprovedCostTotal("proj-unknown")).toBe(0);
    });
  });

  describe("clearChangeRequests", () => {
    it("全データを削除する", () => {
      createChangeRequest(makeParams({ id: "cr-1" }));
      createChangeRequest(makeParams({ id: "cr-2" }));
      clearChangeRequests();
      expect(getChangeRequests()).toHaveLength(0);
    });
  });
});
