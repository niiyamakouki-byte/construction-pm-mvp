/**
 * 見積ドラフト生成 — QuantityTakeoff + cost-master → EstimateDraft
 *
 * 典型的な内装アセンブリ（デフォルト）:
 *   壁:   LGS65両面張り(IN-045) + クロス量産(IN-005)
 *         ※壁タイプ別個別品目: IN-045(LGS65)/IN-046(LGS75)/IN-047(木下地)
 *   床:   フロアタイル(IN-011)
 *   天井: 軽鉄下地シングル(IN-068) + 石膏ボード天井(IN-015)
 *   ドア: 木製建具フラッシュ(FX-001)
 *   巾木: ビニル巾木(IN-012)
 *   廻り縁: IN-024
 */

import type {
  QuantityTakeoff,
  CostMasterItem,
  EstimateDraft,
  EstimateLine,
  DrawingModel,
  InteriorAssembly,
  AssemblyLineSpec,
  TakeoffSource,
  WallType,
  WallTypeMap,
} from "./types.js";
import { WALL_TYPE_RULES } from "./types.js";
import { inferWallType } from "./wall-type-inference.js";

// ─── デフォルトアセンブリ定義 ──────────────────────────────────────

export const DEFAULT_ASSEMBLY: InteriorAssembly = {
  wall: [
    { costMasterCode: "IN-045", quantityFactor: 1.0 },  // LGS65 ボード両面張り（個別品目）
    { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
  ],
  floor: [
    { costMasterCode: "IN-011", quantityFactor: 1.03 }, // フロアタイル（ロス3%）
  ],
  ceiling: [
    { costMasterCode: "IN-068", quantityFactor: 1.0 },  // 軽鉄下地シングル
    { costMasterCode: "IN-015", quantityFactor: 1.0 },  // 石膏ボード天井
  ],
  door: [
    { costMasterCode: "FX-001", quantityFactor: 1.0 },  // 木製建具フラッシュ
  ],
  window: [
    { costMasterCode: "FX-003", quantityFactor: 1.0 },  // ガラス入り建具
  ],
  skirting: [
    { costMasterCode: "IN-012", quantityFactor: 1.0 },  // ビニル巾木
  ],
};

// ─── helpers ──────────────────────────────────────────────────────

function findCostItem(
  code: string,
  costMaster: CostMasterItem[],
): CostMasterItem | undefined {
  return costMaster.find((c) => c.code === code);
}

function buildLines(
  specs: AssemblyLineSpec[],
  quantity: number,
  unit: string,
  source: TakeoffSource,
  confidence: number,
  costMaster: CostMasterItem[],
  notes: string[],
): EstimateLine[] {
  const lines: EstimateLine[] = [];
  for (const spec of specs) {
    const master = findCostItem(spec.costMasterCode, costMaster);
    if (!master) {
      notes.push(`cost-master に未登録: ${spec.costMasterCode}`);
      continue;
    }
    const qty = Math.round(quantity * spec.quantityFactor * 100) / 100;
    const amount = Math.round(qty * master.unitPrice);
    lines.push({
      code: master.code,
      name: master.name,
      quantity: qty,
      unit: unit,
      unitPrice: master.unitPrice,
      amount,
      confidence: Math.round(confidence * 0.8 * 1000) / 1000, // 抽出精度 × 0.8
      source,
    });
  }
  return lines;
}

// ─── Public API ────────────────────────────────────────────────────

/** wallTypeOverride が WallTypeMap かどうかを判定するタイプガード */
function isWallTypeMap(v: WallType | WallTypeMap): v is WallTypeMap {
  return typeof v === "object";
}

const DEFAULT_WALL_TYPE: WallType = "LGS65";

/**
 * QuantityTakeoff と cost-master から EstimateDraft を生成する。
 * drawingModel は出自情報としてドラフトに埋め込むのみ（計算には使わない）。
 *
 * 壁タイプ解決順:
 *   1. options.wallTypeOverride（UI手動指定、単一 WallType または WallTypeMap）
 *   2. options.wallTypeInferenceHints によるテキスト/厚み推定
 *   3. options.assemblyTemplate（カスタムアセンブリ直接指定）
 *   4. DEFAULT_ASSEMBLY（後方互換）
 */

export function composeEstimate(
  takeoff: QuantityTakeoff,
  costMaster: CostMasterItem[],
  drawingModel: DrawingModel,
  options?: {
    assemblyTemplate?: InteriorAssembly;
    /**
     * UI で手動選択した壁タイプ（最優先）。
     * 単一 WallType: 全部屋に同じタイプを適用（後方互換）。
     * WallTypeMap: roomId ごとにタイプを解決。未指定 roomId は LGS65 にフォールバック。
     */
    wallTypeOverride?: WallType | WallTypeMap;
    /** 推定ヒント（テキスト群 or 壁厚） */
    wallTypeInferenceHints?: { texts?: string[]; thicknessMm?: number };
  },
): EstimateDraft {
  // 壁アセンブリ解決
  let assembly: InteriorAssembly;
  let wallTypeNote: string | null = null;

  const wallTypeOverride = options?.wallTypeOverride;
  const isMapMode = wallTypeOverride !== undefined && isWallTypeMap(wallTypeOverride);

  if (wallTypeOverride && !isMapMode) {
    // 後方互換: 単一 WallType
    const rule = WALL_TYPE_RULES[wallTypeOverride as WallType];
    assembly = { ...DEFAULT_ASSEMBLY, wall: rule.defaultAssembly };
    wallTypeNote = `壁タイプ: ${wallTypeOverride}（手動指定）— ${rule.usage}`;
  } else if (options?.wallTypeInferenceHints) {
    const hints = options.wallTypeInferenceHints;
    const result = inferWallType({
      nearbyTexts: hints.texts,
      measuredThicknessMm: hints.thicknessMm,
    });
    const rule = WALL_TYPE_RULES[result.type];
    assembly = { ...DEFAULT_ASSEMBLY, wall: rule.defaultAssembly };
    wallTypeNote = `壁タイプ: ${result.type}（推定 confidence ${Math.round(result.confidence * 100)}%）— ${result.reason}`;
  } else {
    assembly = options?.assemblyTemplate ?? DEFAULT_ASSEMBLY;
  }
  const notes: string[] = [];
  if (wallTypeNote) notes.push(wallTypeNote);
  const allLines: EstimateLine[] = [];

  for (const item of takeoff.items) {
    const conf = item.confidence;
    const src = item.source;

    if (item.category === "壁" && item.item === "壁仕上げ面積") {
      // WallTypeMap モード: roomId ごとに壁アセンブリを解決
      let wallAssembly = assembly.wall;
      if (isMapMode) {
        const map = wallTypeOverride as WallTypeMap;
        const roomId = item.roomId;
        let resolvedType: WallType;
        if (roomId !== undefined && map[roomId] !== undefined) {
          resolvedType = map[roomId];
        } else {
          resolvedType = DEFAULT_WALL_TYPE;
          if (roomId !== undefined) {
            console.warn(`[composeEstimate] roomId "${roomId}" not found in WallTypeMap — fallback to ${DEFAULT_WALL_TYPE}`);
          }
        }
        wallAssembly = WALL_TYPE_RULES[resolvedType].defaultAssembly;
      }
      allLines.push(...buildLines(wallAssembly, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "床" && item.item === "床仕上げ面積") {
      allLines.push(...buildLines(assembly.floor, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "天井" && item.item === "天井仕上げ面積") {
      allLines.push(...buildLines(assembly.ceiling, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "建具" && item.item === "木製建具（ドア）") {
      allLines.push(...buildLines(assembly.door, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "建具" && item.item === "窓") {
      allLines.push(...buildLines(assembly.window, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "造作" && item.item === "巾木") {
      allLines.push(...buildLines(assembly.skirting, item.quantity, item.unit, src, conf, costMaster, notes));
    } else if (item.category === "造作" && item.item === "廻り縁") {
      // 廻り縁は cost-master IN-024
      const master = findCostItem("IN-024", costMaster);
      if (master) {
        const amt = Math.round(item.quantity * master.unitPrice);
        allLines.push({
          code: master.code,
          name: master.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: master.unitPrice,
          amount: amt,
          confidence: Math.round(conf * 0.8 * 1000) / 1000,
          source: src,
        });
      }
    } else if (item.category === "下地" && item.item === "LGS間仕切り下地") {
      // LGS下地は assembly.wall の IN-001 のみ（既に壁アセンブリに含むため、ここではスキップ）
      // 二重計上防止
    }
  }

  const totalExcludingTax = allLines.reduce((s, l) => s + l.amount, 0);

  // confidence: 金額加重平均
  const weightedConf =
    allLines.length > 0 && totalExcludingTax > 0
      ? allLines.reduce((s, l) => s + l.confidence * l.amount, 0) / totalExcludingTax
      : 0;

  if (allLines.length === 0) {
    notes.push("拾い出し結果が空のため見積行を生成できませんでした。");
  }

  return {
    sourcePdfPath: drawingModel.source_pdf,
    drawingModel,
    takeoff,
    lines: allLines,
    totalExcludingTax,
    notes,
    confidence: Math.round(weightedConf * 1000) / 1000,
  };
}
