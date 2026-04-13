/** BuildApp内装蒸留 — BIM連携内装積算自動化 */

import { escapeHtml } from "./utils/escape-html.js";

// ─── Types ──────────────────────────────────────────────────────

export type BIMElement = {
  id: string;
  type: "wall" | "ceiling" | "floor" | "door" | "window" | "column" | "beam";
  material: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    area: number;
    volume: number;
  };
  location: {
    floor: number;
    room?: string;
    zone?: string;
  };
  properties: Record<string, unknown>;
};

export type BIMModel = {
  id: string;
  projectName: string;
  elements: BIMElement[];
  floors: number;
  totalArea: number;
  importedAt: Date;
};

export type MaterialTakeoff = {
  elementId: string;
  elementType: string;
  materials: {
    code?: string;
    name: string;
    unit: string;
    quantity: number;
    wasteFactor: number;
    totalQuantity: number;
    spec?: string;
  }[];
};

export type TakeoffSummary = {
  projectName: string;
  takeoffs: MaterialTakeoff[];
  materialTotals: {
    name: string;
    unit: string;
    totalQuantity: number;
    estimatedCost?: number;
  }[];
  totalEstimatedCost: number;
};

export type PrecutOrder = {
  id: string;
  projectId: string;
  material: string;
  pieces: {
    length: number;
    width: number;
    quantity: number;
    label?: string;
  }[];
  wasteRate: number;
  totalSheets: number;
  createdAt: Date;
};

// ─── BIM parsing ─────────────────────────────────────────────────

/** Parse simplified BIM JSON data into BIMElement array */
export function parseBIMElements(rawData: unknown): BIMElement[] {
  if (!Array.isArray(rawData)) {
    throw new Error("BIMデータは配列形式で指定してください");
  }

  return rawData.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`要素[${index}]がオブジェクトではありません`);
    }
    const obj = item as Record<string, unknown>;

    const validTypes = ["wall", "ceiling", "floor", "door", "window", "column", "beam"] as const;
    const rawType = String(obj["type"] ?? "");
    if (!validTypes.includes(rawType as (typeof validTypes)[number])) {
      throw new Error(`要素[${index}] type "${rawType}" は無効です`);
    }

    const dims = (obj["dimensions"] as Record<string, unknown>) ?? {};
    const loc = (obj["location"] as Record<string, unknown>) ?? {};

    const length = Number(dims["length"] ?? 0);
    const width = Number(dims["width"] ?? 0);
    const height = Number(dims["height"] ?? 0);
    const area = Number(dims["area"] ?? length * width);
    const volume = Number(dims["volume"] ?? area * height);

    return {
      id: String(obj["id"] ?? `elem-${index}`),
      type: rawType as BIMElement["type"],
      material: String(obj["material"] ?? ""),
      dimensions: { length, width, height, area, volume },
      location: {
        floor: Number(loc["floor"] ?? 1),
        room: loc["room"] != null ? String(loc["room"]) : undefined,
        zone: loc["zone"] != null ? String(loc["zone"]) : undefined,
      },
      properties: (obj["properties"] as Record<string, unknown>) ?? {},
    };
  });
}

// ─── Wall takeoff ────────────────────────────────────────────────

/**
 * Calculate wall materials:
 * - LGSスタッド数 (600mmピッチ)
 * - ランナー (上下)
 * - PBシート数 (910×1820mm)
 * - ビス本数
 * - GL量
 * - クロス面積
 */
export function calculateWallTakeoff(wall: BIMElement): MaterialTakeoff {
  const { length, height, area } = wall.dimensions;

  // LGSスタッド: 600mmピッチ → 両端含めて floor(length/0.6)+1
  const studCount = Math.floor(length / 0.6) + 1;

  // ランナー: 上下2本 × 長さ
  const runnerLength = length * 2;

  // PB (910mm×1820mm = 0.91m×1.82m): 両面貼り
  const pbSheetArea = 0.91 * 1.82; // ≈1.6562㎡/枚
  const pbWasteFactor = 1.05;
  const pbSheets = Math.ceil((area / pbSheetArea) * 2 * pbWasteFactor);

  // ビス: PB1枚あたり約25本
  const screwCount = pbSheets * 25;

  // GL(グラスウール): 壁面積
  const glArea = area;

  // クロス: 両面 × ロス係数1.1
  const clothArea = area * 2 * 1.1;

  return {
    elementId: wall.id,
    elementType: "wall",
    materials: [
      {
        code: "LGS-ST",
        name: "LGSスタッド",
        unit: "本",
        quantity: studCount,
        wasteFactor: 1.0,
        totalQuantity: studCount,
        spec: "@600mmピッチ",
      },
      {
        code: "LGS-RN",
        name: "LGSランナー",
        unit: "m",
        quantity: runnerLength,
        wasteFactor: 1.0,
        totalQuantity: runnerLength,
        spec: "上下2本",
      },
      {
        code: "PB-125",
        name: "石膏ボード PB12.5mm",
        unit: "枚",
        quantity: Math.ceil((area / pbSheetArea) * 2),
        wasteFactor: pbWasteFactor,
        totalQuantity: pbSheets,
        spec: "910×1820mm, 両面",
      },
      {
        code: "SCREW-LGS",
        name: "ビス（LGS用）",
        unit: "本",
        quantity: screwCount,
        wasteFactor: 1.0,
        totalQuantity: screwCount,
      },
      {
        code: "GW-50",
        name: "グラスウール 50mm",
        unit: "㎡",
        quantity: glArea,
        wasteFactor: 1.03,
        totalQuantity: Math.round(glArea * 1.03 * 100) / 100,
        spec: "50mm厚",
      },
      {
        code: "CLOTH-VP",
        name: "クロス（VP）",
        unit: "㎡",
        quantity: area * 2,
        wasteFactor: 1.1,
        totalQuantity: Math.round(clothArea * 100) / 100,
        spec: "両面分",
      },
    ],
  };
}

// ─── Ceiling takeoff ─────────────────────────────────────────────

/**
 * Calculate ceiling materials:
 * - 野縁 (300mmピッチ)
 * - 野縁受け (900mmピッチ)
 * - ハンガー
 * - クリップ
 * - 吊りボルト
 * - PB
 * - クロス/岩綿吸音板
 */
export function calculateCeilingTakeoff(ceiling: BIMElement): MaterialTakeoff {
  const { area } = ceiling.dimensions;

  // 野縁(シングルバー): 300mmピッチ → per ㎡ 約3.33m/㎡
  const nofuchLength = area * (1 / 0.3);

  // 野縁受け(Cチャン): 900mmピッチ → per ㎡ 約1.11m/㎡
  const nofuchUkeLength = area * (1 / 0.9);

  // ハンガー: 野縁受け交点 900mm×900mm格子 → 1枚/0.81㎡
  const hangerCount = Math.ceil(area / 0.81);

  // クリップ: 野縁×野縁受け交点 300mm×900mm格子 → 野縁受け1m当たり3本
  const clipCount = Math.ceil(nofuchUkeLength * 3);

  // 吊りボルト: ハンガーと同数
  const boltCount = hangerCount;

  // PB (910×1820mm)
  const pbSheetArea = 0.91 * 1.82;
  const pbWasteFactor = 1.05;
  const pbSheets = Math.ceil((area / pbSheetArea) * pbWasteFactor);

  // クロス/岩綿吸音板: 天井面積 + ロス10%
  const clothArea = area * 1.1;

  return {
    elementId: ceiling.id,
    elementType: "ceiling",
    materials: [
      {
        code: "CEIL-SINGLE",
        name: "野縁（シングルバー）",
        unit: "m",
        quantity: Math.round(nofuchLength * 10) / 10,
        wasteFactor: 1.05,
        totalQuantity: Math.round(nofuchLength * 1.05 * 10) / 10,
        spec: "@300mmピッチ",
      },
      {
        code: "CEIL-CBAR",
        name: "野縁受け（Cチャンネル）",
        unit: "m",
        quantity: Math.round(nofuchUkeLength * 10) / 10,
        wasteFactor: 1.05,
        totalQuantity: Math.round(nofuchUkeLength * 1.05 * 10) / 10,
        spec: "@900mmピッチ",
      },
      {
        code: "CEIL-HANGER",
        name: "ハンガー",
        unit: "個",
        quantity: hangerCount,
        wasteFactor: 1.0,
        totalQuantity: hangerCount,
      },
      {
        code: "CEIL-CLIP",
        name: "クリップ",
        unit: "個",
        quantity: clipCount,
        wasteFactor: 1.0,
        totalQuantity: clipCount,
      },
      {
        code: "CEIL-BOLT",
        name: "吊りボルト（全ネジ）",
        unit: "本",
        quantity: boltCount,
        wasteFactor: 1.0,
        totalQuantity: boltCount,
      },
      {
        code: "PB-125",
        name: "石膏ボード PB12.5mm",
        unit: "枚",
        quantity: Math.ceil(area / pbSheetArea),
        wasteFactor: pbWasteFactor,
        totalQuantity: pbSheets,
        spec: "910×1820mm",
      },
      {
        code: "CEIL-CLOTH",
        name: "クロス/岩綿吸音板",
        unit: "㎡",
        quantity: area,
        wasteFactor: 1.1,
        totalQuantity: Math.round(clothArea * 100) / 100,
      },
    ],
  };
}

// ─── Floor takeoff ───────────────────────────────────────────────

/** Calculate floor materials based on finish type from element properties */
export function calculateFloorTakeoff(floor: BIMElement): MaterialTakeoff {
  const { area } = floor.dimensions;
  const finishType = String(floor.properties["finishType"] ?? "carpet");

  if (finishType === "flooring") {
    const wasteFactor = 1.08;
    return {
      elementId: floor.id,
      elementType: "floor",
      materials: [
        {
          code: "FLOOR-WOOD",
          name: "防音フローリング 12mm",
          unit: "㎡",
          quantity: area,
          wasteFactor,
          totalQuantity: Math.round(area * wasteFactor * 100) / 100,
        },
        {
          code: "ADHESIVE",
          name: "フローリング用接着剤",
          unit: "kg",
          quantity: Math.round(area * 0.4 * 10) / 10,
          wasteFactor: 1.0,
          totalQuantity: Math.round(area * 0.4 * 10) / 10,
        },
        {
          code: "BASEBOARD",
          name: "巾木（木製 60mm高）",
          unit: "m",
          quantity: Math.round(area * 0.4 * 10) / 10,
          wasteFactor: 1.0,
          totalQuantity: Math.round(area * 0.4 * 10) / 10,
        },
      ],
    };
  }

  if (finishType === "tile") {
    const wasteFactor = 1.1;
    return {
      elementId: floor.id,
      elementType: "floor",
      materials: [
        {
          code: "TILE-300",
          name: "磁器タイル 300角",
          unit: "枚",
          quantity: Math.ceil(area / (0.3 * 0.3)),
          wasteFactor,
          totalQuantity: Math.ceil((area / (0.3 * 0.3)) * wasteFactor),
          spec: "300×300mm",
        },
        {
          code: "TILE-MORTAR",
          name: "タイル用モルタル",
          unit: "kg",
          quantity: Math.round(area * 5 * 10) / 10,
          wasteFactor: 1.0,
          totalQuantity: Math.round(area * 5 * 10) / 10,
        },
      ],
    };
  }

  // Default: carpet tile
  const wasteFactor = 1.05;
  return {
    elementId: floor.id,
    elementType: "floor",
    materials: [
      {
        code: "CARPET-TILE",
        name: "タイルカーペット 500角",
        unit: "枚",
        quantity: Math.ceil(area / (0.5 * 0.5)),
        wasteFactor,
        totalQuantity: Math.ceil((area / (0.5 * 0.5)) * wasteFactor),
        spec: "500×500mm",
      },
      {
        code: "CARPET-ADH",
        name: "カーペット用接着剤",
        unit: "kg",
        quantity: Math.round(area * 0.2 * 10) / 10,
        wasteFactor: 1.0,
        totalQuantity: Math.round(area * 0.2 * 10) / 10,
      },
    ],
  };
}

// ─── Full model takeoff ───────────────────────────────────────────

/** Process entire BIM model → full material takeoff */
export function generateFullTakeoff(model: BIMModel): MaterialTakeoff[] {
  const takeoffs: MaterialTakeoff[] = [];

  for (const element of model.elements) {
    switch (element.type) {
      case "wall":
        takeoffs.push(calculateWallTakeoff(element));
        break;
      case "ceiling":
        takeoffs.push(calculateCeilingTakeoff(element));
        break;
      case "floor":
        takeoffs.push(calculateFloorTakeoff(element));
        break;
      // door/window/column/beam — skip detailed takeoff in MVP
      default:
        break;
    }
  }

  return takeoffs;
}

// ─── Material aggregation ─────────────────────────────────────────

/** Aggregate same materials across all elements */
export function aggregateMaterials(
  takeoffs: MaterialTakeoff[],
): TakeoffSummary["materialTotals"] {
  const map = new Map<string, { unit: string; totalQuantity: number }>();

  for (const takeoff of takeoffs) {
    for (const mat of takeoff.materials) {
      const existing = map.get(mat.name);
      if (existing) {
        existing.totalQuantity =
          Math.round((existing.totalQuantity + mat.totalQuantity) * 100) / 100;
      } else {
        map.set(mat.name, {
          unit: mat.unit,
          totalQuantity: mat.totalQuantity,
        });
      }
    }
  }

  return Array.from(map.entries()).map(([name, v]) => ({
    name,
    unit: v.unit,
    totalQuantity: v.totalQuantity,
  }));
}

// ─── Precut plan ──────────────────────────────────────────────────

type PrecutSheet = {
  pieces: { length: number; width: number; label?: string }[];
  usedArea: number;
};

/**
 * Optimize PB/合板 cutting layout to minimize waste.
 * Uses first-fit decreasing bin-packing.
 */
export function generatePrecutPlan(
  takeoffs: MaterialTakeoff[],
  sheetSize: { length: number; width: number } = { length: 1.82, width: 0.91 },
): PrecutOrder[] {
  const orders: PrecutOrder[] = [];

  // Collect all PB materials by code grouping
  const pbGroups = new Map<
    string,
    { name: string; pieces: { length: number; width: number; quantity: number; label?: string }[] }
  >();

  for (const takeoff of takeoffs) {
    for (const mat of takeoff.materials) {
      if (!mat.name.includes("石膏ボード") && !mat.name.includes("合板")) continue;
      const key = mat.code ?? mat.name;
      const existing = pbGroups.get(key);

      // Each sheet as a standard piece
      const pieceL = sheetSize.length;
      const pieceW = sheetSize.width;

      if (existing) {
        const found = existing.pieces.find(
          (p) => p.length === pieceL && p.width === pieceW,
        );
        if (found) {
          found.quantity += mat.totalQuantity;
        } else {
          existing.pieces.push({
            length: pieceL,
            width: pieceW,
            quantity: mat.totalQuantity,
            label: mat.spec,
          });
        }
      } else {
        pbGroups.set(key, {
          name: mat.name,
          pieces: [
            {
              length: pieceL,
              width: pieceW,
              quantity: mat.totalQuantity,
              label: mat.spec,
            },
          ],
        });
      }
    }
  }

  let orderSeq = 1;
  for (const [, group] of pbGroups) {
    // Simple bin-packing: sort pieces descending by area, pack into sheets
    const sheetArea = sheetSize.length * sheetSize.width;
    const sheets: PrecutSheet[] = [];

    const allPieces: { length: number; width: number; label?: string }[] = [];
    for (const piece of group.pieces) {
      for (let i = 0; i < Math.ceil(piece.quantity); i++) {
        allPieces.push({ length: piece.length, width: piece.width, label: piece.label });
      }
    }

    // First fit decreasing
    allPieces.sort((a, b) => b.length * b.width - a.length * a.width);

    for (const piece of allPieces) {
      const pieceArea = piece.length * piece.width;
      let placed = false;
      for (const sheet of sheets) {
        if (sheet.usedArea + pieceArea <= sheetArea + 0.0001) {
          sheet.pieces.push(piece);
          sheet.usedArea += pieceArea;
          placed = true;
          break;
        }
      }
      if (!placed) {
        sheets.push({ pieces: [piece], usedArea: pieceArea });
      }
    }

    // Aggregate pieces back
    const pieceMap = new Map<
      string,
      { length: number; width: number; quantity: number; label?: string }
    >();
    for (const sheet of sheets) {
      for (const p of sheet.pieces) {
        const key = `${p.length}x${p.width}`;
        const existing = pieceMap.get(key);
        if (existing) {
          existing.quantity += 1;
        } else {
          pieceMap.set(key, { length: p.length, width: p.width, quantity: 1, label: p.label });
        }
      }
    }

    const totalUsed = sheets.reduce((s, sh) => s + sh.usedArea, 0);
    const totalSheets = sheets.length;
    const wasteRate =
      totalSheets > 0
        ? Math.round(
            ((totalSheets * sheetArea - totalUsed) / (totalSheets * sheetArea)) * 10000,
          ) / 100
        : 0;

    orders.push({
      id: `precut-${orderSeq++}`,
      projectId: "",
      material: group.name,
      pieces: Array.from(pieceMap.values()),
      wasteRate,
      totalSheets,
      createdAt: new Date(),
    });
  }

  return orders;
}

/** Calculate waste percentage from precut plan */
export function estimatePrecutWaste(plan: PrecutOrder[]): number {
  if (plan.length === 0) return 0;
  const total = plan.reduce((sum, order) => sum + order.wasteRate, 0);
  return Math.round((total / plan.length) * 100) / 100;
}

// ─── Summary builder ──────────────────────────────────────────────

function buildSummary(model: BIMModel, takeoffs: MaterialTakeoff[]): TakeoffSummary {
  const materialTotals = aggregateMaterials(takeoffs);
  return {
    projectName: model.projectName,
    takeoffs,
    materialTotals,
    totalEstimatedCost: 0,
  };
}

// ─── HTML report ──────────────────────────────────────────────────

function formatNum(n: number): string {
  return n.toLocaleString("ja-JP");
}

/** Generate printable HTML takeoff report (by floor, by material) */
export function buildTakeoffReportHtml(summary: TakeoffSummary): string {
  // Group takeoffs by floor
  const floorMap = new Map<number, MaterialTakeoff[]>();
  for (const takeoff of summary.takeoffs) {
    // find original element floor from takeoff — we embed floor in elementId format or fall back to 1
    const floorMatch = takeoff.elementId.match(/-f(\d+)-/);
    const floorNum = floorMatch ? Number(floorMatch[1]) : 1;
    const existing = floorMap.get(floorNum);
    if (existing) {
      existing.push(takeoff);
    } else {
      floorMap.set(floorNum, [takeoff]);
    }
  }

  const floorSections = Array.from(floorMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([floorNum, takeoffList]) => {
      const rows = takeoffList
        .flatMap((t) =>
          t.materials.map(
            (m) => `    <tr>
      <td>${escapeHtml(t.elementId)}</td>
      <td>${escapeHtml(t.elementType)}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.unit)}</td>
      <td class="num">${formatNum(m.quantity)}</td>
      <td class="num">${escapeHtml(String(m.wasteFactor))}</td>
      <td class="num">${formatNum(m.totalQuantity)}</td>
    </tr>`,
          ),
        )
        .join("\n");

      return `  <h2>${floorNum}F</h2>
  <table>
    <thead>
      <tr>
        <th>要素ID</th><th>種別</th><th>材料名</th><th>単位</th>
        <th class="num">数量</th><th class="num">ロス率</th><th class="num">発注数量</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>`;
    })
    .join("\n");

  const totalRows = summary.materialTotals
    .map(
      (m) => `    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.unit)}</td>
      <td class="num">${formatNum(m.totalQuantity)}</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>数量拾い出し — ${escapeHtml(summary.projectName)}</title>
  <style>
    body { font-family: "Meiryo", Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    h2 { font-size: 1.1rem; margin-top: 24px; margin-bottom: 4px; }
    .meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #1f2937; color: white; }
    .num { text-align: right; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>数量拾い出し</h1>
  <div class="meta">
    <span>案件名: ${escapeHtml(summary.projectName)}</span>
    <span>作成日: ${new Date().toLocaleDateString("ja-JP")}</span>
  </div>

${floorSections}

  <h2>材料集計</h2>
  <table>
    <thead>
      <tr><th>材料名</th><th>単位</th><th class="num">合計数量</th></tr>
    </thead>
    <tbody>
${totalRows}
    </tbody>
  </table>
</body>
</html>`;
}

// ─── CSV export ───────────────────────────────────────────────────

/** Export takeoff summary to CSV string */
export function exportTakeoffCSV(summary: TakeoffSummary): string {
  const lines: string[] = [];

  lines.push("要素ID,種別,材料コード,材料名,単位,数量,ロス係数,発注数量,仕様");

  for (const takeoff of summary.takeoffs) {
    for (const mat of takeoff.materials) {
      const row = [
        takeoff.elementId,
        takeoff.elementType,
        mat.code ?? "",
        mat.name,
        mat.unit,
        String(mat.quantity),
        String(mat.wasteFactor),
        String(mat.totalQuantity),
        mat.spec ?? "",
      ]
        .map(csvEscape)
        .join(",");
      lines.push(row);
    }
  }

  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── Comparison ───────────────────────────────────────────────────

export type TakeoffComparison = {
  added: { name: string; unit: string; quantity: number }[];
  removed: { name: string; unit: string; quantity: number }[];
  changed: {
    name: string;
    unit: string;
    quantityA: number;
    quantityB: number;
    diff: number;
    diffPct: number;
  }[];
  unchanged: { name: string; unit: string; quantity: number }[];
};

/** Compare two takeoffs (design change impact analysis) */
export function compareTakeoffs(
  takeoffA: TakeoffSummary,
  takeoffB: TakeoffSummary,
): TakeoffComparison {
  const totalsA = aggregateMaterials(takeoffA.takeoffs);
  const totalsB = aggregateMaterials(takeoffB.takeoffs);

  const mapA = new Map(totalsA.map((m) => [m.name, m]));
  const mapB = new Map(totalsB.map((m) => [m.name, m]));

  const result: TakeoffComparison = {
    added: [],
    removed: [],
    changed: [],
    unchanged: [],
  };

  for (const [name, matB] of mapB) {
    if (!mapA.has(name)) {
      result.added.push({ name, unit: matB.unit, quantity: matB.totalQuantity });
    }
  }

  for (const [name, matA] of mapA) {
    const matB = mapB.get(name);
    if (!matB) {
      result.removed.push({ name, unit: matA.unit, quantity: matA.totalQuantity });
      continue;
    }

    const diff = Math.round((matB.totalQuantity - matA.totalQuantity) * 100) / 100;
    if (Math.abs(diff) < 0.001) {
      result.unchanged.push({ name, unit: matA.unit, quantity: matA.totalQuantity });
    } else {
      const diffPct =
        matA.totalQuantity > 0
          ? Math.round((diff / matA.totalQuantity) * 10000) / 100
          : 100;
      result.changed.push({
        name,
        unit: matA.unit,
        quantityA: matA.totalQuantity,
        quantityB: matB.totalQuantity,
        diff,
        diffPct,
      });
    }
  }

  return result;
}

// ─── Re-export summary builder ────────────────────────────────────

export { buildSummary as buildTakeoffSummary };
