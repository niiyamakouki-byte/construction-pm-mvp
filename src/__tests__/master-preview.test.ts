/**
 * master-preview — calcMasterPreview 純関数単体テスト
 */

import { describe, expect, it } from "vitest";
import { calcMasterPreview } from "../lib/master-preview.js";
import type { WBSTask } from "../lib/work-breakdown/types.js";

const makeTask = (id: string, defaultDays: number): WBSTask => ({
  id,
  groupId: "g1",
  categoryId: "cat1",
  name: `タスク ${id}`,
  defaultDays,
});

const ENTRIES: WBSTask[] = [
  makeTask("t1", 3),
  makeTask("t2", 5),
  makeTask("t3", 2),
  makeTask("t4", 7),
];

describe("calcMasterPreview", () => {
  it("ゼロ選択時は count=0, totalDays=0 を返す", () => {
    const result = calcMasterPreview(new Set(), ENTRIES);
    expect(result).toEqual({ count: 0, totalDays: 0 });
  });

  it("単一選択: count=1, totalDays=該当エントリのdays", () => {
    const result = calcMasterPreview(new Set(["t2"]), ENTRIES);
    expect(result).toEqual({ count: 1, totalDays: 5 });
  });

  it("複数選択: count=選択数, totalDays=選択合計", () => {
    const result = calcMasterPreview(new Set(["t1", "t3", "t4"]), ENTRIES);
    expect(result).toEqual({ count: 3, totalDays: 12 });
  });

  it("全選択: count=4, totalDays=17", () => {
    const result = calcMasterPreview(new Set(["t1", "t2", "t3", "t4"]), ENTRIES);
    expect(result).toEqual({ count: 4, totalDays: 17 });
  });

  it("defaultDays が 0 以下のエントリは totalDays に加算しない", () => {
    const entries: WBSTask[] = [
      makeTask("a", 0),
      makeTask("b", -1),
      makeTask("c", 4),
    ];
    const result = calcMasterPreview(new Set(["a", "b", "c"]), entries);
    expect(result).toEqual({ count: 3, totalDays: 4 });
  });

  it("selectedIds にエントリ外の ID が含まれていても無視する", () => {
    const result = calcMasterPreview(new Set(["t1", "nonexistent"]), ENTRIES);
    expect(result).toEqual({ count: 1, totalDays: 3 });
  });

  it("空エントリ配列ではすべて 0", () => {
    const result = calcMasterPreview(new Set(["t1"]), []);
    expect(result).toEqual({ count: 0, totalDays: 0 });
  });
});
