/**
 * PDF→見積ドラフト パイプライン — 共通型定義
 *
 * DrawingModel は pdf-vector-extractor（Python）が出力する JSON の TypeScript 表現。
 * 直接 import せず JSON.parse 経由で受け取る前提（別プロセス）。
 */

// ─── DrawingModel (pdf-vector-extractor 出力の TS 鏡像) ────────────

export type Point = { x: number; y: number };

export type PdfLine = {
  start: Point;
  end: Point;
  thickness: number | null;
  color: string | null;
  layer: string | null;
  semantic: "wall" | "opening" | "dimension_line" | "auxiliary" | "unknown" | null;
  length_pt: number;
  length_mm: number | null;
};

export type TextItem = {
  text: string;
  position: Point;
  font_size: number;
  is_dimension_value: boolean;
  parsed_mm: number | null;
};

export type PdfRect = {
  top_left: Point;
  bottom_right: Point;
  layer: string | null;
};

export type DrawingModel = {
  source_pdf: string;
  page_index: number;
  page_size_pt: Point;
  scale: string | null;          // e.g. "1:50"
  scale_mm_per_pt: number | null;
  lines: PdfLine[];
  rects: PdfRect[];
  texts: TextItem[];
  layers: string[];
  extracted_at: string;
};

// ─── InteriorElement ──────────────────────────────────────────────

export type WallGeometry = {
  startMm: Point;
  endMm: Point;
  lengthMm: number;
  thicknessMm: number;
};

export type OpeningGeometry = {
  centerMm: Point;
  widthMm: number;
  heightMm: number;
  openingType: "door" | "window" | "unknown";
};

export type RoomGeometry = {
  polygonMm: Point[];
  areaSqM: number;
};

export type FloorAreaGeometry = {
  polygonMm: Point[];
  areaSqM: number;
};

export type InteriorElement =
  | { kind: "wall"; geometry: WallGeometry; inferredFrom: { pdfPage: number; confidence: number } }
  | { kind: "opening"; geometry: OpeningGeometry; inferredFrom: { pdfPage: number; confidence: number } }
  | { kind: "room"; geometry: RoomGeometry; inferredFrom: { pdfPage: number; confidence: number } }
  | { kind: "floor_area"; geometry: FloorAreaGeometry; inferredFrom: { pdfPage: number; confidence: number } };

// ─── QuantityTakeoff ──────────────────────────────────────────────

export type TakeoffUnit = "m" | "m2" | "個";
export type TakeoffSource = "pdf" | "manual" | "ai_estimate";

export type TakeoffItem = {
  category: string;
  item: string;
  quantity: number;
  unit: TakeoffUnit;
  source: TakeoffSource;
  confidence: number;
};

export type QuantityTakeoff = {
  items: TakeoffItem[];
  /** 天井高（mm）— 数量計算に使用 */
  ceilingHeightMm: number;
};

// ─── EstimateDraft ────────────────────────────────────────────────

export type CostMasterItem = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  note?: string;
};

export type EstimateLine = {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  /** 0.0〜1.0、PDF抽出精度に由来 */
  confidence: number;
  source: TakeoffSource;
};

export type EstimateDraft = {
  sourcePdfPath: string;
  drawingModel: DrawingModel;
  takeoff: QuantityTakeoff;
  lines: EstimateLine[];
  totalExcludingTax: number;
  notes: string[];
  /** 全行の confidence 加重平均 */
  confidence: number;
};

// ─── AssemblyTemplate ─────────────────────────────────────────────

export type AssemblyLineSpec = {
  costMasterCode: string;
  /** 数量係数 (1.0 = 原面積そのまま) */
  quantityFactor: number;
};

export type InteriorAssembly = {
  wall: AssemblyLineSpec[];
  floor: AssemblyLineSpec[];
  ceiling: AssemblyLineSpec[];
  door: AssemblyLineSpec[];
  window: AssemblyLineSpec[];
  skirting: AssemblyLineSpec[];
};

// ─── LGS壁タイプ ─────────────────────────────────────────────────
//
// 光輝さん（ラポルタ代表）の現場知見:
//   LGS20ランナー: 天井補強・梁型・GLボンド不可壁の下地（3用途）
//   LGS45:        ふかせない壁（壁厚制約が強い） ← メイン
//   LGS65:        一般間仕切り（最頻出）           ← メイン
//   LGS50/75:     補助的利用（中頻度）
//   LGS90/100:    遮音・耐火強化（稀）

export type WallType =
  | "LGS20_runner"
  | "LGS45"
  | "LGS50"
  | "LGS65"
  | "LGS75"
  | "LGS90"
  | "LGS100"
  | "木下地";

export interface WallTypeRule {
  type: WallType;
  /** 下地本体の公称厚み（mm） */
  nominalThicknessMm: number;
  /** 仕上げ込みの総壁厚 典型範囲 [min, max] mm */
  typicalWallThicknessMm: [number, number];
  /** 用途説明（日本語） */
  usage: string;
  /** cost-masterベースのデフォルトアセンブリ（壁面のみ） */
  defaultAssembly: InteriorAssembly["wall"];
  /**
   * 推定優先度。高いほど優先採用。
   * LGS45/65 = 10（メイン）, LGS50/75 = 3（補助）, LGS20/90/100 = 1〜2（稀）
   */
  priority: number;
}

/**
 * LGS壁タイプ別ルール定義。
 *
 * LGS65/LGS75/木下地/LGS90/LGS100 は個別品目（IN-045〜049）を使用（係数依存から脱却）。
 * その他タイプは IN-001（LGS間仕切り65型 ¥5,500/㎡）に係数を掛けて調整:
 *   LGS20_runner: 軽量（0.60） / LGS45: やや薄（0.85）
 */
export const WALL_TYPE_RULES: Record<WallType, WallTypeRule> = {
  LGS20_runner: {
    type: "LGS20_runner",
    nominalThicknessMm: 20,
    typicalWallThicknessMm: [30, 60],
    usage: "天井補強・梁型・GLボンド不可の壁下地",
    priority: 2,
    defaultAssembly: [
      { costMasterCode: "IN-001", quantityFactor: 0.60 }, // ランナー材のみ・軽量
      { costMasterCode: "IN-003", quantityFactor: 1.0 },
      { costMasterCode: "IN-005", quantityFactor: 1.05 },
    ],
  },
  LGS45: {
    type: "LGS45",
    nominalThicknessMm: 45,
    typicalWallThicknessMm: [75, 95],
    usage: "ふかせない壁（壁厚制約強）",
    priority: 10, // ← メイン用途
    defaultAssembly: [
      { costMasterCode: "IN-001", quantityFactor: 0.85 }, // 65型より薄い分コスト低
      { costMasterCode: "IN-003", quantityFactor: 1.0 },
      { costMasterCode: "IN-005", quantityFactor: 1.05 },
    ],
  },
  LGS50: {
    type: "LGS50",
    nominalThicknessMm: 50,
    typicalWallThicknessMm: [80, 100],
    usage: "補助",
    priority: 3,
    defaultAssembly: [
      { costMasterCode: "IN-001", quantityFactor: 0.90 },
      { costMasterCode: "IN-003", quantityFactor: 1.0 },
      { costMasterCode: "IN-005", quantityFactor: 1.05 },
    ],
  },
  LGS65: {
    type: "LGS65",
    nominalThicknessMm: 65,
    typicalWallThicknessMm: [95, 115],
    usage: "一般間仕切り（メイン）",
    priority: 10, // ← メイン用途
    defaultAssembly: [
      { costMasterCode: "IN-045", quantityFactor: 1.0 }, // IN-045 = LGS65 ボード両面張り（個別品目）
      { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
    ],
  },
  LGS75: {
    type: "LGS75",
    nominalThicknessMm: 75,
    typicalWallThicknessMm: [105, 125],
    usage: "補助",
    priority: 3,
    defaultAssembly: [
      { costMasterCode: "IN-046", quantityFactor: 1.0 }, // IN-046 = LGS75 ボード両面張り（個別品目）
      { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
    ],
  },
  LGS90: {
    type: "LGS90",
    nominalThicknessMm: 90,
    typicalWallThicknessMm: [120, 140],
    usage: "遮音・耐火強化（稀）",
    priority: 1,
    defaultAssembly: [
      { costMasterCode: "IN-048", quantityFactor: 1.0 }, // IN-048 = LGS90 ボード両面張り（個別品目）
      { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
    ],
  },
  LGS100: {
    type: "LGS100",
    nominalThicknessMm: 100,
    typicalWallThicknessMm: [130, 150],
    usage: "遮音・耐火強化（稀）",
    priority: 1,
    defaultAssembly: [
      { costMasterCode: "IN-049", quantityFactor: 1.0 }, // IN-049 = LGS100 ボード両面張り（個別品目）
      { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
    ],
  },
  木下地: {
    type: "木下地",
    nominalThicknessMm: 45,
    typicalWallThicknessMm: [80, 120],
    usage: "木製下地（間柱）ボード両面張り",
    priority: 5,
    defaultAssembly: [
      { costMasterCode: "IN-047", quantityFactor: 1.0 }, // IN-047 = 木下地 ボード両面張り（個別品目）
      { costMasterCode: "IN-005", quantityFactor: 1.05 }, // クロス（ロス5%）
    ],
  },
};
