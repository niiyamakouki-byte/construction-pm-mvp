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

// ── ドア開閉アーチ（建具スイング弧）検出パラメータ ──
// 平面図ではドアは 1/4 円の開閉弧（スイングアーク）で描かれる CAD 慣習を利用する。
const DOOR_ARC_RADIUS_MIN_MM = 550;  // 単扉 1 枚 600〜900mm、両開き半分・公差込みで下限 550
const DOOR_ARC_RADIUS_MAX_MM = 1100; // 上限 1100mm
const DOOR_ARC_SWEEP_MIN_RAD = (70 * Math.PI) / 180;  // 約 1/4 回転（下限 70°）
const DOOR_ARC_SWEEP_MAX_RAD = (110 * Math.PI) / 180; // 約 1/4 回転（上限 110°）
const DOOR_DEDUP_CENTER_TOLERANCE_MM = 50; // 同心・同径の弧（両引き重複描画）は 1 枚に集約

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

function isWallLine(line: PdfLine, scaleMmPerPt: number | null): boolean {
  // ドア開閉弧（建具スイングアーク）は壁ではなく開口として扱う（二重計上防止）
  if (isDoorSwingArc(line, scaleMmPerPt)) return false;
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

/** 角度差を (0, 2π] に正規化する */
function normalizeSweep(delta: number): number {
  const twoPi = 2 * Math.PI;
  let s = Math.abs(delta) % twoPi;
  if (s === 0) s = twoPi;
  // [π, 2π) の掃引は反対回りで見れば 1/4 回転にも相当するため折り返す
  if (s > Math.PI) s = twoPi - s;
  return s;
}

/**
 * 線がドア開閉弧（建具スイングアーク）か判定する。
 * 半径 550〜1100mm かつ掃引角 70〜110°（≒1/4回転）の弧を 1 ドアとみなす。
 * scale_mm_per_pt が null（縮尺不明）の場合はサイズ判定不能のため false。
 */
function isDoorSwingArc(line: PdfLine, scaleMmPerPt: number | null): boolean {
  const arc = line.arc;
  if (!arc || scaleMmPerPt === null) return false;
  const radiusMm = arc.radius * scaleMmPerPt;
  if (radiusMm < DOOR_ARC_RADIUS_MIN_MM || radiusMm > DOOR_ARC_RADIUS_MAX_MM) return false;
  const sweep = normalizeSweep(arc.end_angle - arc.start_angle);
  return sweep >= DOOR_ARC_SWEEP_MIN_RAD && sweep <= DOOR_ARC_SWEEP_MAX_RAD;
}

/**
 * ドア開閉弧（建具スイングアーク）から開口要素を検出する。
 * scale_mm_per_pt が null（縮尺不明）の場合はサイズ判定不能のため空配列を返す。
 * 半径 550〜1100mm かつ掃引角 70〜110°（≒1/4回転）の弧を 1 ドアとみなす。
 * 中心 ~50mm 以内・同径の弧は両引き重複描画として 1 枚に集約する。
 *
 * line.arc は Python 版/TS 版のどちらの pdf-vector-extractor でも供給されうる。
 * TS 版は path-extractor が四分円相当の cubic bezier を PdfArc として復元する。
 */
function detectDoorsFromArcs(
  drawing: DrawingModel,
  scaleMmPerPt: number | null,
): InteriorElement[] {
  if (scaleMmPerPt === null) return [];
  const s = scaleMmPerPt;
  const result: InteriorElement[] = [];
  // dedup 用: 既採用ドアの中心(mm)と半径(mm)
  const seen: { centerMm: Point; radiusMm: number }[] = [];

  for (const line of drawing.lines) {
    if (!isDoorSwingArc(line, s)) continue;
    const radiusMm = (line.arc as PdfArc).radius * s;

    // 建具スイングの回転中心 = arc.center
    const centerMm: Point = {
      x: (line.arc as PdfArc).center.x * s,
      y: (line.arc as PdfArc).center.y * s,
    };
    // 両引き重複描画の集約: 同心(~50mm)・同径の弧は 1 枚にまとめる
    const dup = seen.some(
      (d) =>
        Math.hypot(d.centerMm.x - centerMm.x, d.centerMm.y - centerMm.y) <=
          DOOR_DEDUP_CENTER_TOLERANCE_MM && Math.abs(d.radiusMm - radiusMm) <= DOOR_DEDUP_CENTER_TOLERANCE_MM,
    );
    if (dup) continue;
    seen.push({ centerMm, radiusMm });

    result.push({
      kind: "opening",
      geometry: {
        centerMm,
        widthMm: radiusMm,          // ドア有効幅 ≒ スイング半径
        heightMm: 2000,             // 標準ドア高さ（建具スイング弧には高さ情報がないため仮定）
        openingType: "door",
      },
      inferredFrom: { pdfPage: drawing.page_index, confidence: 0.6 },
    });
  }
  return result;
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

/**
 * 壁の端点連結が成す「全ての」内部閉領域（部屋）を平面分割の面として列挙する。
 *
 * 半辺(directed half-edge)を各頂点まわりの方向角順に辿り、最小閉路（面）を全列挙する
 * 標準的な planar face traversal。共有壁は 1 辺の 2 つの半辺がそれぞれ別の部屋面に
 * 属するため、隣接する複数部屋を正しく分離できる（従来は最初の 1 ループしか拾えず
 * 2 部屋目の床/天井が欠落していた）。
 *
 * 各連結成分につき面積最大の面 = 外周面（内部面積の総和に一致）を 1 枚除外する。
 * 端点一致は ENDPOINT_TOLERANCE_PT（1.0pt）許容。任意角度の壁・円弧壁に対応する。
 */
function detectRoomFaces(walls: PdfLine[], s: number): RoomGeometry[] {
  const tol = ENDPOINT_TOLERANCE_PT;

  // ① 頂点クラスタリング（tol 内を同一頂点に）
  const verts: Point[] = [];
  const vidOf = (p: Point): number => {
    for (let i = 0; i < verts.length; i++) {
      if (Math.hypot(verts[i].x - p.x, verts[i].y - p.y) <= tol) return i;
    }
    verts.push({ x: p.x, y: p.y });
    return verts.length - 1;
  };

  // ② 辺を構築（直線同士の完全重複のみ dedup。円弧は端点を共有しても残す）
  type Edge = { a: number; b: number; pts: Point[]; isArc: boolean };
  const edges: Edge[] = [];
  for (const w of walls) {
    const poly = wallToPolyline(w);
    if (poly.length < 2) continue;
    const a = vidOf(poly[0]);
    const b = vidOf(poly[poly.length - 1]);
    if (a === b) continue; // 長さ 0（点）除外
    const isArc = !!w.arc;
    const dup = edges.some(
      (e) =>
        !e.isArc &&
        !isArc &&
        ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
    );
    if (dup) continue;
    // 端点はクラスタ代表点に正規化（中間点は円弧の分割点）
    edges.push({ a, b, pts: [verts[a], ...poly.slice(1, -1), verts[b]], isArc });
  }
  // 円弧壁を含む場合 2 辺でも閉領域（半円など）を成すため最低 2 辺を許容
  if (edges.length < 2) return [];

  // ③ 連結成分（union-find）
  const parent = verts.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const nx = parent[x];
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  for (const e of edges) parent[find(e.a)] = find(e.b);

  // ④ 半辺生成（各辺 → 双方向 2 本）
  type HalfEdge = { u: number; v: number; pts: Point[]; ang: number; twin: number };
  const he: HalfEdge[] = [];
  const dir = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x);
  for (const e of edges) {
    const fwd = e.pts;
    const rev = [...e.pts].reverse();
    const i0 = he.length;
    he.push({ u: e.a, v: e.b, pts: fwd, ang: dir(fwd[0], fwd[1]), twin: i0 + 1 });
    he.push({ u: e.b, v: e.a, pts: rev, ang: dir(rev[0], rev[1]), twin: i0 });
  }

  // ⑤ 各頂点の出半辺を方向角昇順ソート
  const out: number[][] = verts.map(() => []);
  for (let i = 0; i < he.length; i++) out[he[i].u].push(i);
  for (const list of out) list.sort((p, q) => he[p].ang - he[q].ang);
  const posInOut = new Array<number>(he.length).fill(-1);
  for (const list of out) list.forEach((hi, idx) => (posInOut[hi] = idx));

  // ⑥ next: 半辺 e=(u→v) の次は、v で twin(e)=(v→u) の 1 つ時計回り側の出半辺
  const nextOf = (i: number): number => {
    const t = he[i].twin; // (v→u)
    const list = out[he[i].v];
    const k = list.length;
    return list[(posInOut[t] - 1 + k) % k];
  };

  // ⑦ 面を辿る
  const visited = new Array<boolean>(he.length).fill(false);
  type Face = { polyMm: Point[]; areaSqM: number; comp: number };
  const faces: Face[] = [];
  for (let i = 0; i < he.length; i++) {
    if (visited[i]) continue;
    const comp = find(he[i].u);
    const polyPt: Point[] = [];
    let cur = i;
    let guard = 0;
    while (!visited[cur]) {
      visited[cur] = true;
      const seg = he[cur].pts;
      if (polyPt.length === 0) polyPt.push(...seg);
      else polyPt.push(...seg.slice(1));
      cur = nextOf(cur);
      if (++guard > he.length + 2) break;
    }
    if (polyPt.length >= 2) {
      const f = polyPt[0];
      const l = polyPt[polyPt.length - 1];
      if (Math.hypot(f.x - l.x, f.y - l.y) <= tol) polyPt.pop(); // 閉じ点重複除去
    }
    if (polyPt.length >= 3) {
      const mm = polyPt.map((p) => ({ x: p.x * s, y: p.y * s }));
      faces.push({ polyMm: mm, areaSqM: shoelaceAreaSqM(mm), comp });
    }
  }

  // ⑧ 連結成分ごとに面積最大の面（外周）を 1 枚除外し、残りを部屋とする
  const byComp = new Map<number, Face[]>();
  for (const f of faces) {
    const arr = byComp.get(f.comp);
    if (arr) arr.push(f);
    else byComp.set(f.comp, [f]);
  }
  const rooms: RoomGeometry[] = [];
  for (const list of byComp.values()) {
    let maxIdx = 0;
    for (let i = 1; i < list.length; i++) {
      if (list[i].areaSqM > list[maxIdx].areaSqM) maxIdx = i;
    }
    list.forEach((f, idx) => {
      if (idx !== maxIdx && f.areaSqM > 0.5) {
        rooms.push({ polygonMm: f.polyMm, areaSqM: f.areaSqM });
      }
    });
  }
  return rooms;
}

/**
 * 壁線の端点を使い、連結した閉じた多角形を検出する。
 * まず端点連結ベースで実ポリゴン（斜め壁・円弧壁を含む）を探し、
 * 見つからない場合は直交壁の AABB グリッド推定にフォールバックする。
 */
function detectRooms(walls: PdfLine[], scaleMmPerPt: number): RoomGeometry[] {
  if (walls.length === 0) return [];

  const s = scaleMmPerPt;

  // ① 端点連結による実ポリゴン検出（任意角度・円弧対応・複数部屋対応）
  const faceRooms = detectRoomFaces(walls, s);
  if (faceRooms.length > 0) return faceRooms;

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

  const wallLines = drawing.lines.filter((line) => isWallLine(line, drawing.scale_mm_per_pt));
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

  // ドア開閉弧（建具スイングアーク）からドア開口を検出
  elements.push(...detectDoorsFromArcs(drawing, drawing.scale_mm_per_pt));

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
