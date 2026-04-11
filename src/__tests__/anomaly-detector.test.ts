import { describe, it, expect } from "vitest";
import { detectAnomalies } from "../lib/anomaly-detector";
import type { ParsedEstimateItem } from "../estimate/nl-estimate-parser";

function makeItem(code: string, name: string = code): ParsedEstimateItem {
  return {
    code,
    quantity: 10,
    matchedKeyword: name,
    itemName: name,
    quantityBasis: "テスト",
  };
}

describe("detectAnomalies", () => {
  it("仕上げのみで撤去なし → no-demolish警告", () => {
    const items = [makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items);
    expect(alerts.some((a) => a.id === "no-demolish")).toBe(true);
  });

  it("撤去+仕上げセット → no-demolish警告なし", () => {
    const items = [makeItem("DM-005", "カーペット撤去"), makeItem("IN-008", "タイルカーペット")];
    const alerts = detectAnomalies(items);
    expect(alerts.some((a) => a.id === "no-demolish")).toBe(false);
  });

  it("養生費なし → no-protection警告", () => {
    const items = [makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items);
    expect(alerts.some((a) => a.id === "no-protection")).toBe(true);
  });

  it("養生費あり → no-protection警告なし", () => {
    const items = [makeItem("DM-009", "養生"), makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items);
    expect(alerts.some((a) => a.id === "no-protection")).toBe(false);
  });

  it("品目空 → 警告なし", () => {
    const alerts = detectAnomalies([]);
    expect(alerts).toHaveLength(0);
  });

  it("単価が業界平均を大幅に下回る → price-too-low警告", () => {
    const items = [makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items, { totalAmount: 1000, areaSqm: 100 }); // 10円/㎡
    expect(alerts.some((a) => a.id === "price-too-low")).toBe(true);
  });

  it("単価が業界平均を大幅に上回る → price-too-high警告", () => {
    const items = [makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items, { totalAmount: 10000000, areaSqm: 10 }); // 1,000,000円/㎡
    expect(alerts.some((a) => a.id === "price-too-high")).toBe(true);
  });

  it("正常な単価 → 価格警告なし", () => {
    const items = [makeItem("IN-005", "クロス")];
    const alerts = detectAnomalies(items, { totalAmount: 200000, areaSqm: 20 }); // 10,000円/㎡
    expect(alerts.some((a) => a.id === "price-too-low")).toBe(false);
    expect(alerts.some((a) => a.id === "price-too-high")).toBe(false);
  });
});
