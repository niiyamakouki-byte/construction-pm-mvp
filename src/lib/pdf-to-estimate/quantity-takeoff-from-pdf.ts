/**
 * 数量拾い — InteriorElement[] → QuantityTakeoff
 *
 * 計算ルール:
 *   壁面積 (m²) = Σ(壁長さ m) × 天井高 m
 *   床面積 (m²) = Σ部屋ポリゴン面積
 *   天井面積 (m²) = 床面積（フラット前提）
 *   巾木 (m)   = Σ壁長さ − Σ開口幅
 *   廻り縁 (m) = 巾木と同値（天井境界）
 *   建具数 (個) = 開口数（ドア/窓別）
 */

import type {
  InteriorElement,
  QuantityTakeoff,
  TakeoffItem,
  TakeoffSource,
} from "./types.js";

const DEFAULT_CEILING_HEIGHT_MM = 2400;
const DEFAULT_INCLUDE_FOOTMOLDING = true;

export type TakeoffOptions = {
  defaultCeilingHeight?: number;   // mm、デフォルト 2400
  includeFootmolding?: boolean;    // 巾木を含める（デフォルト true）
  includeCrownMolding?: boolean;   // 廻り縁を含める（デフォルト true）
};

// ─── helpers ──────────────────────────────────────────────────────

function avgConfidence(items: InteriorElement[], kind: InteriorElement["kind"]): number {
  const matches = items.filter((e) => e.kind === kind);
  if (matches.length === 0) return 0;
  return matches.reduce((s, e) => s + e.inferredFrom.confidence, 0) / matches.length;
}

function makeItem(
  category: string,
  item: string,
  quantity: number,
  unit: TakeoffItem["unit"],
  source: TakeoffSource,
  confidence: number,
): TakeoffItem {
  return {
    category,
    item,
    quantity: Math.round(quantity * 100) / 100,
    unit,
    source,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * 内装要素リストから数量を算出する。
 * 要素が空でも呼び出し可能（全数量 0 で返る）。
 */
export function takeoffFromInterior(
  elements: InteriorElement[],
  options?: TakeoffOptions,
): QuantityTakeoff {
  const ceilingMm = options?.defaultCeilingHeight ?? DEFAULT_CEILING_HEIGHT_MM;
  const ceilingM = ceilingMm / 1000;
  const inclFootmolding = options?.includeFootmolding ?? DEFAULT_INCLUDE_FOOTMOLDING;
  const inclCrownMolding = options?.includeCrownMolding ?? true;

  // ── 壁 ────────────────────────────────────────────────────────
  const walls = elements.filter((e) => e.kind === "wall");
  const totalWallLengthM = walls.reduce((s, e) => {
    const g = (e as Extract<InteriorElement, { kind: "wall" }>).geometry;
    return s + g.lengthMm / 1000;
  }, 0);
  const wallConfidence = avgConfidence(elements, "wall");

  // ── 開口 ──────────────────────────────────────────────────────
  const openings = elements.filter((e) => e.kind === "opening");
  const doors = openings.filter(
    (e) => (e as Extract<InteriorElement, { kind: "opening" }>).geometry.openingType === "door",
  );
  const windows = openings.filter(
    (e) => (e as Extract<InteriorElement, { kind: "opening" }>).geometry.openingType === "window",
  );
  const totalOpeningWidthM = openings.reduce((s, e) => {
    const g = (e as Extract<InteriorElement, { kind: "opening" }>).geometry;
    return s + g.widthMm / 1000;
  }, 0);
  const openingConfidence = avgConfidence(elements, "opening");

  // ── 床・天井 ──────────────────────────────────────────────────
  const floorAreas = elements.filter((e) => e.kind === "floor_area");
  const totalFloorSqM = floorAreas.reduce((s, e) => {
    const g = (e as Extract<InteriorElement, { kind: "floor_area" }>).geometry;
    return s + g.areaSqM;
  }, 0);
  const floorConfidence = avgConfidence(elements, "floor_area");

  // ── 派生数量 ──────────────────────────────────────────────────
  const wallAreaSqM = totalWallLengthM * ceilingM;
  const ceilingSqM = totalFloorSqM; // フラット前提
  const skirtingM = Math.max(0, totalWallLengthM - totalOpeningWidthM);
  const crownMoldingM = skirtingM; // 廻り縁も同程度

  const source: TakeoffSource = "pdf";
  const items: TakeoffItem[] = [];

  // 壁面積
  if (wallAreaSqM > 0) {
    items.push(
      makeItem("壁", "壁仕上げ面積", wallAreaSqM, "m2", source, wallConfidence),
    );
  }

  // 床面積
  if (totalFloorSqM > 0) {
    items.push(
      makeItem("床", "床仕上げ面積", totalFloorSqM, "m2", source, floorConfidence),
    );
  }

  // 天井面積
  if (ceilingSqM > 0) {
    items.push(
      makeItem("天井", "天井仕上げ面積", ceilingSqM, "m2", source, floorConfidence),
    );
  }

  // 建具（ドア）
  if (doors.length > 0) {
    items.push(
      makeItem(
        "建具",
        "木製建具（ドア）",
        doors.length,
        "個",
        source,
        openingConfidence,
      ),
    );
  }

  // 建具（窓）
  if (windows.length > 0) {
    items.push(
      makeItem(
        "建具",
        "窓",
        windows.length,
        "個",
        source,
        openingConfidence,
      ),
    );
  }

  // 巾木
  if (inclFootmolding && skirtingM > 0) {
    items.push(
      makeItem("造作", "巾木", skirtingM, "m", source, wallConfidence * 0.9),
    );
  }

  // 廻り縁
  if (inclCrownMolding && crownMoldingM > 0) {
    items.push(
      makeItem("造作", "廻り縁", crownMoldingM, "m", source, wallConfidence * 0.85),
    );
  }

  // LGS 間仕切り（壁面積から推算）
  if (wallAreaSqM > 0) {
    items.push(
      makeItem("下地", "LGS間仕切り下地", wallAreaSqM, "m2", source, wallConfidence * 0.8),
    );
  }

  return { items, ceilingHeightMm: ceilingMm };
}
