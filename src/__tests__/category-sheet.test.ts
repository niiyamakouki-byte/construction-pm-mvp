import { describe, expect, it } from "vitest";
import {
  formatCategorySheetCSV,
  formatCategorySheetMarkdown,
} from "../estimate/category-sheet";

describe("category-sheet", () => {
  it("formats scaffolding markdown as a standalone breakdown sheet", () => {
    const sheet = formatCategorySheetMarkdown("scaffolding");
    expect(sheet).toContain("# 仮設工事 明細シート");
    expect(sheet).toContain("| SC-001 | 枠組足場（外壁） | 足場 | ㎡ | 1,200 | 800~1,800 |");
    expect(sheet).toContain("| SC-008 | 安全ネット | 安全 | ㎡ | 400 | 250~600 |");
  });

  it("formats plastering csv with line-item rows", () => {
    const sheet = formatCategorySheetCSV("plastering");
    expect(sheet).toContain("コード,品目,細目,単位,標準単価,価格帯下限,価格帯上限,備考");
    expect(sheet).toContain("\"PL2-009\",\"モルタル造形（木目調）\",\"造形\",\"㎡\",\"25000\",\"18000\",\"35000\"");
    expect(sheet).toContain("\"PL2-012\",\"エイジング塗装\",\"塗装\",\"㎡\",\"8000\",\"5000\",\"15000\"");
  });

  it("throws on unknown category", () => {
    expect(() => formatCategorySheetMarkdown("unknown")).toThrow(
      "カテゴリ unknown が見つかりません",
    );
  });
});
