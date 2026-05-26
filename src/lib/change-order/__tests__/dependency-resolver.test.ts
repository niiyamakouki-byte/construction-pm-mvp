/**
 * dependency-resolver unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  resolveDownstreamChain,
  resolveUpstreamChain,
  resolveDependencyChain,
  DEFAULT_WORK_DEPENDENCIES,
} from "../dependency-resolver.js";
import type { WorkNode } from "../dependency-resolver.js";

describe("resolveDownstreamChain", () => {
  it("解体工事から始まる連鎖を解決する", () => {
    const chain = resolveDownstreamChain(["demolition"]);
    // 解体→躯体→防水、粗配管、粗配線→断熱→下地→各仕上げ…
    expect(chain.length).toBeGreaterThan(0);
    expect(chain.some((n) => n.includes("躯体"))).toBe(true);
  });

  it("末端ノードは空配列を返す", () => {
    const chain = resolveDownstreamChain(["cleanup"]);
    expect(chain).toEqual([]);
  });

  it("存在しないIDは無視される", () => {
    const chain = resolveDownstreamChain(["nonexistent"]);
    expect(chain).toEqual([]);
  });

  it("複数のスタートノードを受け付ける", () => {
    const chain = resolveDownstreamChain(["wall_finish", "floor_finish"]);
    expect(chain.some((n) => n.includes("電気") || n.includes("配管") || n.includes("清掃"))).toBe(true);
  });

  it("カスタムノードグラフで動作する", () => {
    const nodes: WorkNode[] = [
      { id: "a", nameJa: "工事A", dependsOn: [] },
      { id: "b", nameJa: "工事B", dependsOn: ["a"] },
      { id: "c", nameJa: "工事C", dependsOn: ["b"] },
    ];
    const chain = resolveDownstreamChain(["a"], nodes);
    expect(chain).toContain("工事B");
    expect(chain).toContain("工事C");
  });

  it("循環参照があっても無限ループしない", () => {
    const nodes: WorkNode[] = [
      { id: "a", nameJa: "工事A", dependsOn: ["c"] },
      { id: "b", nameJa: "工事B", dependsOn: ["a"] },
      { id: "c", nameJa: "工事C", dependsOn: ["b"] },
    ];
    // Should not throw or hang
    expect(() => resolveDownstreamChain(["a"], nodes)).not.toThrow();
  });
});

describe("resolveUpstreamChain", () => {
  it("壁仕上げの上流 (前工程) を解決する", () => {
    const chain = resolveUpstreamChain(["wall_finish"]);
    expect(chain.some((n) => n.includes("下地"))).toBe(true);
    expect(chain.some((n) => n.includes("断熱"))).toBe(true);
  });

  it("起点ノードは結果に含まれない", () => {
    const chain = resolveUpstreamChain(["wall_finish"]);
    expect(chain.some((n) => n.includes("壁仕上げ"))).toBe(false);
  });

  it("起点の前工程がない場合は空", () => {
    const chain = resolveUpstreamChain(["demolition"]);
    expect(chain).toEqual([]);
  });
});

describe("resolveDependencyChain", () => {
  it("壁仕上げ変更の後続工程を返す", () => {
    const chain = resolveDependencyChain(["wall_finish"]);
    // 壁仕上げ→電気仕上、配管仕上、器具取付、塗装、清掃
    expect(chain.some((n) => n.includes("電気") || n.includes("塗装") || n.includes("清掃"))).toBe(true);
  });

  it("DEFAULT_WORK_DEPENDENCIES が正しく使われる", () => {
    // 基本デフォルト値チェック
    expect(DEFAULT_WORK_DEPENDENCIES.length).toBeGreaterThan(10);
    expect(DEFAULT_WORK_DEPENDENCIES.find((n) => n.id === "wall_finish")).toBeDefined();
  });

  it("空配列を渡すと空を返す", () => {
    const chain = resolveDependencyChain([]);
    expect(chain).toEqual([]);
  });
});
