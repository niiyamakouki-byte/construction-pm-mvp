/**
 * 内装セマンティック層
 * DrawingModel（pdf-vector-extractor 出力）→ InteriorElement[]
 *
 * 判定基準:
 *   壁線: semantic="wall" または (length_mm >= 500 && thickness >= 0.5pt)
 *   開口: semantic="opening" または 壁線の切れ目に隣接する短線セグメント
 *   部屋: 壁線が形成する閉じた多角形 → Shoelace 面積
 *   床面積: 部屋領域と同一（フラット前提）
 */

import type {
  DrawingModel,
  PdfLine,
  PdfArc,
  InteriorElement,
  WallGeometry,
  OpeningGeometry,
  RoomGeometry,
  Point,
} from "./types.js";

const WALL_MIN_LENGTH_MM = 500;
const WALL_MIN_THICKNESS_PT = 0.5;
const OPENING_MAX_WIDTH_MM = 1200;
const OPENING_MIN_WIDTH_MM = 400;
const DEFAULT_OPENING_HEIGHT_MM = 2100;

// ─── Geometry helpers ──────────────────────────────────────────────

/** Shoelace formula — polygon points in mm */
function shoelaceAreaSqM(polygon: Point[]): number {
  const n = polygon.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  // polygon points are in mm → convert mm² to m²
  return Math.abs(area) / 2 / 1_000_000;
}

function lineLengthMm(line: PdfLine): number {
  if (line.length_mm !== null) return line.length_mm;
  // fallback: pt (no scale)
  return line.length_pt;
}

function midpoint(line: PdfLine): Point {
  return {
    x: (line.start.x + line.end.x) / 2,
    y: (line.start.y + line.end.y) / 2,
  };
}

/** Distance between two points in PDF point units */
function _dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Wall detection ────────────────────────────────────────────────

function isWallLine(line: PdfLine): boolean {
  if (line.semantic === "wall") return true;
  if (line.semantic === "auxiliary" || line.semantic === "dimension_line") return false;
  const lenMm = lineLengthMm(line);
  const thick = line.thickness ?? 0;
  return lenMm >= WALL_MIN_LENGTH_MM && thick >= WALL_MIN_THICKNESS_PT;
}

function toWallGeometry(line: PdfLine, scaleMmPerPt: number): WallGeometry {
  const s = scaleMmPerPt;
  const startMm: Point = { x: line.start.x * s, y: line.start.y * s };
  const endMm: Point = { x: line.end.x * s, y: line.end.y * s };
  // Euclidean length — handles diagonal walls at any angle (Math.hypot)
  const lengthMm = Math.hypot(endMm.x - startMm.x, endMm.y - startMm.y);
  const thicknessMm = (line.thickness ?? 1) * s;
  return { startMm, endMm, lengthMm, thicknessMm };
}

// ─── Opening detection ─────────────────────────────────────────────

/**
 * 開口: semantic="opening" の短線、または壁線の近傍にある短セグメント。
 * 幅は line.length_mm で推定。
 */
function isOpeningLine(line: PdfLine): boolean {
  if (line.semantic === "opening") return true;
  return false;
}

function toOpeningGeometry(line: PdfLine, scaleMmPerPt: number): OpeningGeometry {
  const s = scaleMmPerPt;
  const widthMm = lineLengthMm(line);
  const centerMm: Point = {
    x: midpoint(line).x * s,
    y: midpoint(line).y * s,
  };
  // 窓と扉の簡易判別: widthMm が 600〜900 → door 候補
  const openingType: OpeningGeometry["openingType"] =
    widthMm >= 600 && widthMm <= 900 ? "door" : widthMm < 600 ? "window" : "unknown";
  return { centerMm, widthMm, heightMm: DEFAULT_OPENING_HEIGHT_MM, openingType };
}

// ─── Room / floor area detection ───────────────────────────────────

const ARC_MIN_SEGMENTS = 8;
const ARC_MAX_SEGMENTS = 32;
/** 弦の端点一致とみなす許容距離（pt） */
const ENDPOINT_TOLERANCE_PT = 1.0;

/**
 * 円弧を弧長に応じて 8〜32 本の直線セグメントに分割し、中間点列を返す。
 * 返す点は始点を含まず終点を含む（ポリライン連結用）。座標は pt 単位。
 */
function tessellateArc(arc: PdfArc): Point[] {
  const sweep = arc.end_angle - arc.start_angle;
  const arcLen = Math.abs(sweep) * arc.radius;
  // 弧長 500pt ごとに 1 分割を目安にし、8〜32 にクランプ
  const segments = Math.max(
    ARC_MIN_SEGMENTS,
    Math.min(ARC_MAX_SEGMENTS, Math.ceil(arcLen / 500)),
  );
  const points: Point[] = [];
  for (let k = 1; k <= segments; k++) {
    const t = arc.start_angle + (sweep * k) / segments;
    points.push({
      x: arc.center.x + arc.radius * Math.cos(t),
      y: arc.center.y + arc.radius * Math.sin(t),
    });
  }
  return points;
}

/** 壁を pt 単位のポリライン（始点込み）に展開する。円弧は分割する。 */
function wallToPolyline(wall: PdfLine): Point[] {
  if (wall.arc) {
    return [{ x: wall.start.x, y: wall.start.y }, ...tessellateArc(wall.arc)];
  }
  return [
    { x: wall.start.x, y: wall.start.y },
    { x: wall.end.x, y: wall.end.y },
  ];
}

function pointsCoincide(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= ENDPOINT_TOLERANCE_PT;
}

/**
 * 壁セグメントの端点連結をたどり、閉じたループ（最初の壁の始点に戻る）を 1 つ探す。
 * 見つかった場合、そのループを構成する点列（pt 単位、円弧は分割済み）を返す。
 * 見つからなければ null。任意の角度の壁・円弧壁に対応する。
 */
function traceClosedLoop(walls: PdfLine[]): Point[] | null {
  // 円弧壁を含む場合 2 本でも閉領域を成すため、最低 2 本を許容する
  if (walls.length < 2) return null;

  const used = new Array<boolean>(walls.length).fill(false);
  const startWall = walls[0];
  const startPoly = wallToPolyline(startWall);
  used[0] = true;

  const loopStart = startPoly[0];
  const points: Point[] = [...startPoly];
  let current = points[points.length - 1];

  // 最大 walls.length-1 回、連結する壁を辿る
  for (let step = 0; step < walls.length - 1; step++) {
    let advanced = false;
    for (let i = 0; i < walls.length; i++) {
      if (used[i]) continue;
      const poly = wallToPolyline(walls[i]);
      const head = poly[0];
      const tail = poly[poly.length - 1];
      if (pointsCoincide(current, head)) {
        points.push(...poly.slice(1));
        used[i] = true;
        current = points[points.length - 1];
        advanced = true;
        break;
      }
      if (pointsCoincide(current, tail)) {
        // 逆向きに連結
        const reversed = poly.slice(0, -1).reverse();
        points.push(...reversed);
        used[i] = true;
        current = points[points.length - 1];
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
    if (pointsCoincide(current, loopStart)) {
      // 閉ループ完成（末尾の重複点を除く）
      return points.slice(0, -1);
    }
  }

  return null;
}

/**
 * 壁線の端点を使い、連結した閉じた多角形を検出する。
 * まず端点連結ベースで実ポリゴン（斜め壁・円弧壁を含む）を探し、
 * 見つからない場合は直交壁の AABB グリッド推定にフォールバックする。
 */
function detectRooms(walls: PdfLine[], scaleMmPerPt: number): RoomGeometry[] {
  if (walls.length === 0) return [];

  const s = scaleMmPerPt;

  // ① 端点連結による実ポリゴン検出（任意角度・円弧対応）
  const loopPt = traceClosedLoop(walls);
  if (loopPt && loopPt.length >= 3) {
    const polygonMm = loopPt.map((p) => ({ x: p.x * s, y: p.y * s }));
    const areaSqM = shoelaceAreaSqM(polygonMm);
    if (areaSqM > 0.5) {
      return [{ polygonMm, areaSqM }];
    }
  }

  // ② フォールバック: 直交壁の AABB グリッド推定（従来挙動）

  // 水平・垂直壁の端点から AABB グループを作る（簡易版）
  const hWalls = walls.filter((w) => {
    const dy = Math.abs(w.end.y - w.start.y);
    const dx = Math.abs(w.end.x - w.start.x);
    return dx > dy;
  });
  const vWalls = walls.filter((w) => {
    const dy = Math.abs(w.end.y - w.start.y);
    const dx = Math.abs(w.end.x - w.start.x);
    return dy >= dx;
  });

  if (hWalls.length === 0 || vWalls.length === 0) return [];

  // Y座標でグループ化: 水平壁をペアにする
  const yCoords = hWalls.map((w) => (w.start.y + w.end.y) / 2).sort((a, b) => a - b);
  const xCoords = vWalls.map((w) => (w.start.x + w.end.x) / 2).sort((a, b) => a - b);

  const rooms: RoomGeometry[] = [];

  // 隣接する水平ペア × 垂直ペアで矩形部屋を推定
  for (let i = 0; i < yCoords.length - 1; i++) {
    for (let j = 0; j < xCoords.length - 1; j++) {
      const y1 = yCoords[i];
      const y2 = yCoords[i + 1];
      const x1 = xCoords[j];
      const x2 = xCoords[j + 1];

      const widthPt = Math.abs(x2 - x1);
      const heightPt = Math.abs(y2 - y1);

      // 最小部屋サイズ 1m × 1m (1000mm)
      if (widthPt * s < 1000 || heightPt * s < 1000) continue;

      const polygon: Point[] = [
        { x: x1 * s, y: y1 * s },
        { x: x2 * s, y: y1 * s },
        { x: x2 * s, y: y2 * s },
        { x: x1 * s, y: y2 * s },
      ];
      const areaSqM = shoelaceAreaSqM(polygon);
      if (areaSqM > 0.5) {
        rooms.push({ polygonMm: polygon, areaSqM });
      }
    }
  }

  // 重複除去: 中心点が 300mm 以内のものはマージ
  const deduped: RoomGeometry[] = [];
  for (const room of rooms) {
    const cx = room.polygonMm.reduce((s, p) => s + p.x, 0) / room.polygonMm.length;
    const cy = room.polygonMm.reduce((s, p) => s + p.y, 0) / room.polygonMm.length;
    const duplicate = deduped.some((r) => {
      const rx = r.polygonMm.reduce((s, p) => s + p.x, 0) / r.polygonMm.length;
      const ry = r.polygonMm.reduce((s, p) => s + p.y, 0) / r.polygonMm.length;
      return Math.sqrt((rx - cx) ** 2 + (ry - cy) ** 2) < 300;
    });
    if (!duplicate) deduped.push(room);
  }

  return deduped;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * DrawingModel を受け取り、内装要素（壁・開口・部屋・床面積）に分類する。
 * scale_mm_per_pt が null の場合は pt 単位のまま（精度低下、confidence 0.3 固定）。
 */
export function classifyInteriorElements(drawing: DrawingModel): InteriorElement[] {
  const scaleMmPerPt = drawing.scale_mm_per_pt ?? 1;
  const hasScale = drawing.scale_mm_per_pt !== null;
  const baseConf = hasScale ? 0.8 : 0.3;

  const elements: InteriorElement[] = [];

  const wallLines = drawing.lines.filter(isWallLine);
  const openingLines = drawing.lines.filter(isOpeningLine);

  // 壁線
  for (const line of wallLines) {
    const geometry = toWallGeometry(line, scaleMmPerPt);
    const confidence = hasScale
      ? Math.min(0.95, baseConf + (geometry.thicknessMm > 50 ? 0.1 : 0))
      : baseConf;
    elements.push({
      kind: "wall",
      geometry,
      inferredFrom: { pdfPage: drawing.page_index, confidence },
    });
  }

  // 開口（semantic="opening" の線）
  for (const line of openingLines) {
    const lenMm = lineLengthMm(line);
    if (lenMm < OPENING_MIN_WIDTH_MM || lenMm > OPENING_MAX_WIDTH_MM) continue;
    const geometry = toOpeningGeometry(line, scaleMmPerPt);
    elements.push({
      kind: "opening",
      geometry,
      inferredFrom: { pdfPage: drawing.page_index, confidence: baseConf * 0.85 },
    });
  }

  // 矩形から開口を補完（壁線で囲まれた小さい矩形 = 建具記号）
  for (const rect of drawing.rects) {
    const widthPt = Math.abs(rect.bottom_right.x - rect.top_left.x);
    const heightPt = Math.abs(rect.bottom_right.y - rect.top_left.y);
    const widthMm = widthPt * scaleMmPerPt;
    const heightMm = heightPt * scaleMmPerPt;
    if (
      widthMm >= OPENING_MIN_WIDTH_MM &&
      widthMm <= OPENING_MAX_WIDTH_MM &&
      heightMm < 200
    ) {
      const centerMm: Point = {
        x: ((rect.top_left.x + rect.bottom_right.x) / 2) * scaleMmPerPt,
        y: ((rect.top_left.y + rect.bottom_right.y) / 2) * scaleMmPerPt,
      };
      elements.push({
        kind: "opening",
        geometry: {
          centerMm,
          widthMm,
          heightMm: DEFAULT_OPENING_HEIGHT_MM,
          openingType: widthMm <= 900 ? "door" : "window",
        },
        inferredFrom: { pdfPage: drawing.page_index, confidence: baseConf * 0.75 },
      });
    }
  }

  // 部屋領域検出
  const rooms = detectRooms(wallLines, scaleMmPerPt);
  for (const room of rooms) {
    elements.push({
      kind: "room",
      geometry: room,
      inferredFrom: { pdfPage: drawing.page_index, confidence: baseConf * 0.7 },
    });
    // 床面積は部屋と同じ多角形
    elements.push({
      kind: "floor_area",
      geometry: { polygonMm: room.polygonMm, areaSqM: room.areaSqM },
      inferredFrom: { pdfPage: drawing.page_index, confidence: baseConf * 0.7 },
    });
  }

  return elements;
}
