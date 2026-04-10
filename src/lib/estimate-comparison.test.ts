import { describe, expect, it } from "vitest";
import {
  compareEstimates,
  generateComparisonReport,
  selectBestPrices,
} from "./estimate-comparison.js";
import type { CompetitorEstimate } from "./estimate-comparison.js";

const makeEstimate = (
  id: string,
  name: string,
  items: { name: string; unitPrice: number; quantity: number }[],
): CompetitorEstimate => ({
  contractorId: id,
  contractorName: name,
  items: items.map((i) => ({ ...i, amount: i.unitPrice * i.quantity })),
  totalAmount: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
  submittedDate: "2026-04-01",
});

const est1 = makeEstimate("c1", "業者A", [
  { name: "床材", unitPrice: 5000, quantity: 10 },
  { name: "壁紙", unitPrice: 2000, quantity: 20 },
]);

const est2 = makeEstimate("c2", "業者B", [
  { name: "床材", unitPrice: 4500, quantity: 10 },
  { name: "壁紙", unitPrice: 2200, quantity: 20 },
]);

const est3 = makeEstimate("c3", "業者C", [
  { name: "床材", unitPrice: 5200, quantity: 10 },
  { name: "壁紙", unitPrice: 1800, quantity: 20 },
]);

describe("compareEstimates", () => {
  it("空配列は空結果を返す", () => {
    const result = compareEstimates([]);
    expect(result.itemComparisons).toHaveLength(0);
    expect(result.totalComparison).toHaveLength(0);
    expect(result.bestContractorId).toBe("");
  });

  it("品目ごとに最安・最高・平均単価を計算する", () => {
    const result = compareEstimates([est1, est2, est3]);

    const floorItem = result.itemComparisons.find((ic) => ic.itemName === "床材");
    expect(floorItem).toBeDefined();
    expect(floorItem!.minUnitPrice).toBe(4500);
    expect(floorItem!.maxUnitPrice).toBe(5200);
    expect(floorItem!.avgUnitPrice).toBe(Math.round((5000 + 4500 + 5200) / 3));
    expect(floorItem!.bestContractorId).toBe("c2");

    const wallItem = result.itemComparisons.find((ic) => ic.itemName === "壁紙");
    expect(wallItem!.minUnitPrice).toBe(1800);
    expect(wallItem!.bestContractorId).toBe("c3");
  });

  it("合計金額が最安の業者をbestContractorIdに設定する", () => {
    const result = compareEstimates([est1, est2, est3]);
    // est1: 50000+40000=90000, est2: 45000+44000=89000, est3: 52000+36000=88000
    expect(result.bestContractorId).toBe("c3");
  });

  it("totalComparisonに全業者の合計金額が含まれる", () => {
    const result = compareEstimates([est1, est2]);
    expect(result.totalComparison).toHaveLength(2);
    const c1 = result.totalComparison.find((t) => t.contractorId === "c1");
    expect(c1!.totalAmount).toBe(90000);
  });
});

describe("selectBestPrices", () => {
  it("空配列は空結果を返す", () => {
    expect(selectBestPrices([])).toHaveLength(0);
  });

  it("各品目で最安業者を選択する", () => {
    const result = selectBestPrices([est1, est2, est3]);

    const floor = result.find((r) => r.itemName === "床材");
    expect(floor!.bestContractorId).toBe("c2");
    expect(floor!.unitPrice).toBe(4500);

    const wall = result.find((r) => r.itemName === "壁紙");
    expect(wall!.bestContractorId).toBe("c3");
    expect(wall!.unitPrice).toBe(1800);
  });

  it("amountが unitPrice * quantity と一致する", () => {
    const result = selectBestPrices([est1, est2]);
    result.forEach((sel) => {
      expect(sel.amount).toBe(sel.unitPrice * sel.quantity);
    });
  });
});

describe("generateComparisonReport", () => {
  it("空配列は空結果を返す", () => {
    expect(generateComparisonReport([])).toHaveLength(0);
  });

  it("各行にisBest=trueの業者が1社以上含まれる", () => {
    const report = generateComparisonReport([est1, est2, est3]);
    expect(report.length).toBeGreaterThan(0);
    report.forEach((line) => {
      const bestEntries = line.contractors.filter((c) => c.isBest);
      expect(bestEntries.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("savingsVsAvgが平均単価と最安単価の差である", () => {
    const report = generateComparisonReport([est1, est2, est3]);
    const floorLine = report.find((r) => r.itemName === "床材");
    const avgPrice = Math.round((5000 + 4500 + 5200) / 3);
    expect(floorLine!.savingsVsAvg).toBe(avgPrice - 4500);
  });
});
