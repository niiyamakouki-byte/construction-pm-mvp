/**
 * dependency-resolver — 工事間の波及連鎖をDAGで解決する。
 *
 * Sprint 17-B: 変更管理ワークフロー
 * 「壁仕上げ変更」→「電気配線」→「内装下地」のような依存チェーンを辿る。
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkNode = {
  id: string;
  nameJa: string;
  /** 先行作業IDリスト (この作業が完了してから当作業が始まる) */
  dependsOn: string[];
};

// ── Default dependency map (内装工事の典型的な依存関係) ────────────────────

export const DEFAULT_WORK_DEPENDENCIES: WorkNode[] = [
  { id: "demolition", nameJa: "解体工事", dependsOn: [] },
  { id: "concrete", nameJa: "躯体工事", dependsOn: ["demolition"] },
  { id: "waterproof", nameJa: "防水工事", dependsOn: ["concrete"] },
  { id: "rough_plumbing", nameJa: "配管工事（粗配管）", dependsOn: ["concrete"] },
  { id: "rough_electric", nameJa: "電気配線（粗配線）", dependsOn: ["concrete"] },
  { id: "insulation", nameJa: "断熱工事", dependsOn: ["rough_plumbing", "rough_electric"] },
  { id: "underlay", nameJa: "内装下地工事", dependsOn: ["insulation"] },
  { id: "wall_finish", nameJa: "壁仕上げ工事", dependsOn: ["underlay"] },
  { id: "floor_finish", nameJa: "床仕上げ工事", dependsOn: ["underlay"] },
  { id: "ceiling_finish", nameJa: "天井仕上げ工事", dependsOn: ["underlay"] },
  { id: "finish_electric", nameJa: "電気工事（仕上）", dependsOn: ["wall_finish", "ceiling_finish"] },
  { id: "finish_plumbing", nameJa: "配管工事（仕上）", dependsOn: ["wall_finish", "floor_finish"] },
  { id: "fixture", nameJa: "器具取付工事", dependsOn: ["finish_electric", "finish_plumbing"] },
  { id: "painting", nameJa: "塗装工事", dependsOn: ["wall_finish", "ceiling_finish"] },
  { id: "cleanup", nameJa: "清掃・養生", dependsOn: ["fixture", "painting"] },
];

// ── Graph traversal ────────────────────────────────────────────────────────

/**
 * 指定ノードから downstream (依存先) の全ノードをトポロジカル順で返す。
 * cycleがある場合は途中で打ち切る。
 */
export function resolveDownstreamChain(
  startIds: string[],
  nodes: WorkNode[] = DEFAULT_WORK_DEPENDENCIES,
): string[] {
  const nodeMap = new Map<string, WorkNode>(nodes.map((n) => [n.id, n]));

  // Build reverse map: nodeId → nodes that depend on it
  const dependents = new Map<string, string[]>();
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(node.id);
    }
  }

  const visited = new Set<string>();
  const result: string[] = [];
  const queue = [...startIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodeMap.get(current);
    if (node && !startIds.includes(current)) {
      result.push(node.nameJa);
    }

    const deps = dependents.get(current) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  return result;
}

/**
 * 指定ノードから upstream (前工程) の全ノードをトポロジカル順で返す。
 */
export function resolveUpstreamChain(
  startIds: string[],
  nodes: WorkNode[] = DEFAULT_WORK_DEPENDENCIES,
): string[] {
  const nodeMap = new Map<string, WorkNode>(nodes.map((n) => [n.id, n]));

  const visited = new Set<string>();
  const result: string[] = [];
  const queue = [...startIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodeMap.get(current);
    if (node && !startIds.includes(current)) {
      result.push(node.nameJa);
    }

    for (const dep of node?.dependsOn ?? []) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  return result;
}

/**
 * 変更対象ノードに影響する全ての依存チェーンを解決する。
 * downstream (後続工程) を返す。
 */
export function resolveDependencyChain(
  targetWorkIds: string[],
  nodes: WorkNode[] = DEFAULT_WORK_DEPENDENCIES,
): string[] {
  return resolveDownstreamChain(targetWorkIds, nodes);
}
