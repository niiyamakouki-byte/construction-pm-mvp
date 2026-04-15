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
