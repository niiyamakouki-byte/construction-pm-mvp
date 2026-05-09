/**
 * 欠陥検出モジュール
 *
 * IDetector インターフェースを公開し、現在は RuleBasedDetector を提供する。
 * 将来 ONNX/YOLO モデルへの差し替えは IDetector を実装するだけでよい。
 *
 * 注意: RuleBasedDetector は誤検知率が高い。
 * 将来的には ONNX YOLO モデルへの差し替えを予定。
 */

import type { Defect, DefectKind } from "./types.js";

// uuid相当の簡易ID生成（外部依存なし）
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── インターフェース ───────────────────────────────────────────────────────────

/** ピクセルデータから欠陥リストを返す純粋なインターフェース */
export interface IDetector {
  detect(imageData: ImageDataLike): Promise<Defect[]>;
}

/**
 * ImageData の最小インターフェース
 * ブラウザの ImageData・テスト用フィクスチャ両方に対応
 */
export interface ImageDataLike {
  width: number;
  height: number;
  /** RGBA フラット配列 (Uint8ClampedArray or number[]) */
  data: Uint8ClampedArray | number[];
}

// ── Sobel エッジ検出ユーティリティ ───────────────────────────────────────────

/**
 * グレースケール変換
 * RGB → 輝度 (0-255)
 */
function toGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 3x3 Sobel 勾配の大きさを計算
 * gray[y][x] の形の2次元配列を受け取る
 */
function sobelMagnitude(gray: number[][], y: number, x: number, h: number, w: number): number {
  const get = (dy: number, dx: number): number =>
    gray[Math.max(0, Math.min(h - 1, y + dy))][Math.max(0, Math.min(w - 1, x + dx))];

  const gx =
    -get(-1, -1) - 2 * get(0, -1) - get(1, -1) +
     get(-1,  1) + 2 * get(0,  1) + get(1,  1);
  const gy =
    -get(-1, -1) - 2 * get(-1, 0) - get(-1, 1) +
     get( 1, -1) + 2 * get( 1, 0) + get( 1, 1);

  return Math.sqrt(gx * gx + gy * gy);
}

// ── カラーヒストグラムユーティリティ ──────────────────────────────────────────

/** RGBA配列からグリッド分割した局所平均色を返す */
function localMeanColor(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  gridX: number,
  gridY: number,
  gridW: number,
  gridH: number,
): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0, count = 0;
  const x1 = Math.max(0, gridX);
  const y1 = Math.max(0, gridY);
  const x2 = Math.min(width, gridX + gridW);
  const y2 = Math.min(height, gridY + gridH);

  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const idx = (y * width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  return { r: r / count, g: g / count, b: b / count };
}

// ── RuleBasedDetector ────────────────────────────────────────────────────────

/**
 * ルールベース欠陥検出器
 *
 * アルゴリズム:
 * 1. グレースケール変換 → Sobel エッジ検出 → エッジ密度が高い領域を crack/scratch 候補に
 * 2. カラーヒストグラム → 茶色・黒系の局所集中を stain/water_damage 候補に
 * 3. 局所コントラスト異常 → 隣接グリッド間の輝度差が大きい箇所を misalignment/peeling 候補に
 * 4. 極端な暗領域 → missing_part 候補に
 *
 * 注意: 誤検知率が高い。将来的に ONNX YOLO 差し替え予定。
 */
export class RuleBasedDetector implements IDetector {
  /** Sobel エッジ閾値: この値を超えるピクセルをエッジとみなす */
  private readonly EDGE_THRESHOLD = 80;
  /** エッジ密度がこの値を超えるグリッドを crack/scratch 候補に */
  private readonly EDGE_DENSITY_CRACK = 0.15;
  private readonly EDGE_DENSITY_SCRATCH = 0.08;
  /** 水濡れ検出: 青みがかった暗色の密度閾値 */
  private readonly WATER_STAIN_BLUE_RATIO = 0.3;
  /** 汚れ検出: 赤成分が高い茶色系の閾値 */
  private readonly STAIN_RED_THRESHOLD = 120;
  /** 局所コントラスト (隣グリッド間の輝度差) の閾値 */
  private readonly MISALIGN_CONTRAST_THRESHOLD = 40;
  /** 欠陥検出の最小信頼度 */
  private readonly MIN_CONFIDENCE = 0.3;

  async detect(imageData: ImageDataLike): Promise<Defect[]> {
    const { width, height, data } = imageData;
    if (width === 0 || height === 0) return [];

    // グレースケール 2D 配列を構築
    const gray: number[][] = [];
    for (let y = 0; y < height; y++) {
      gray[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        gray[y][x] = toGray(data[idx], data[idx + 1], data[idx + 2]);
      }
    }

    // グリッド分割 (最大 4x4 = 16セル)
    const GRID_COLS = Math.min(4, width);
    const GRID_ROWS = Math.min(4, height);
    const cellW = width / GRID_COLS;
    const cellH = height / GRID_ROWS;

    const defects: Defect[] = [];

    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const x0 = Math.floor(gx * cellW);
        const y0 = Math.floor(gy * cellH);
        const cw = Math.floor(cellW);
        const ch = Math.floor(cellH);
        const x1 = Math.min(width, x0 + cw);
        const y1 = Math.min(height, y0 + ch);

        // ── Sobel エッジ密度 ────────────────────────────────────────────────
        let edgePixels = 0;
        let totalPixels = 0;
        let sumGray = 0;

        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const mag = sobelMagnitude(gray, py, px, height, width);
            if (mag > this.EDGE_THRESHOLD) edgePixels++;
            sumGray += gray[py][px];
            totalPixels++;
          }
        }

        if (totalPixels === 0) continue;

        const edgeDensity = edgePixels / totalPixels;
        const meanGray = sumGray / totalPixels;

        // bbox 正規化
        const bbox = {
          x: x0 / width,
          y: y0 / height,
          w: (x1 - x0) / width,
          h: (y1 - y0) / height,
        };

        // ── ひび割れ検出 (高エッジ密度) ─────────────────────────────────────
        if (edgeDensity >= this.EDGE_DENSITY_CRACK) {
          defects.push({
            id: genId(),
            kind: "crack" as DefectKind,
            bbox,
            confidence: Math.min(0.9, this.MIN_CONFIDENCE + edgeDensity * 3),
            notes: `エッジ密度: ${(edgeDensity * 100).toFixed(1)}%`,
          });
          continue;
        }

        // ── 傷検出 (中程度エッジ密度) ────────────────────────────────────────
        if (edgeDensity >= this.EDGE_DENSITY_SCRATCH) {
          defects.push({
            id: genId(),
            kind: "scratch" as DefectKind,
            bbox,
            confidence: Math.min(0.7, this.MIN_CONFIDENCE + edgeDensity * 2),
            notes: `エッジ密度: ${(edgeDensity * 100).toFixed(1)}%`,
          });
          continue;
        }

        // ── 色ヒストグラム解析 ────────────────────────────────────────────────
        const { r, g, b } = localMeanColor(data, width, height, x0, y0, cw, ch);

        // 水濡れ検出: 青みが強く暗い領域
        if (b > r + 20 && b > g && meanGray < 120) {
          defects.push({
            id: genId(),
            kind: "water_damage" as DefectKind,
            bbox,
            confidence: Math.min(0.75, this.MIN_CONFIDENCE + (b - r) / 255),
            notes: `青成分優位: R=${Math.round(r)} G=${Math.round(g)} B=${Math.round(b)}`,
          });
          continue;
        }

        // 汚れ検出: 赤茶色系 (r > g, b が低い)
        if (r > this.STAIN_RED_THRESHOLD && r > g + 15 && r > b + 15 && meanGray < 160) {
          defects.push({
            id: genId(),
            kind: "stain" as DefectKind,
            bbox,
            confidence: Math.min(0.65, this.MIN_CONFIDENCE + (r - g) / 255),
            notes: `赤みがかった汚れ: R=${Math.round(r)} G=${Math.round(g)} B=${Math.round(b)}`,
          });
          continue;
        }

        // 変色検出: 黄色がかった領域 (r≈g > b)
        if (r > 150 && g > 130 && b < r - 30 && Math.abs(r - g) < 30) {
          defects.push({
            id: genId(),
            kind: "discoloration" as DefectKind,
            bbox,
            confidence: Math.min(0.5, this.MIN_CONFIDENCE + (r - b) / 512),
            notes: `黄変: R=${Math.round(r)} G=${Math.round(g)} B=${Math.round(b)}`,
          });
          continue;
        }

        // ── 極端に暗い領域 → 部品欠損候補 ─────────────────────────────────
        if (meanGray < 30) {
          defects.push({
            id: genId(),
            kind: "missing_part" as DefectKind,
            bbox,
            confidence: Math.min(0.6, this.MIN_CONFIDENCE + (30 - meanGray) / 60),
            notes: `暗領域: 平均輝度=${meanGray.toFixed(1)}`,
          });
          continue;
        }

        // ── 隣接グリッドとのコントラスト差 → 施工ズレ/剥がれ ─────────────────
        if (gx > 0) {
          const prevX = Math.floor((gx - 1) * cellW);
          const { r: pr, g: pg, b: pb } = localMeanColor(data, width, height, prevX, y0, cw, ch);
          const prevGray = toGray(pr, pg, pb);
          const contrastDiff = Math.abs(meanGray - prevGray);

          if (contrastDiff > this.MISALIGN_CONTRAST_THRESHOLD) {
            const kind: DefectKind = contrastDiff > 70 ? "peeling" : "misalignment";
            defects.push({
              id: genId(),
              kind,
              bbox,
              confidence: Math.min(0.65, this.MIN_CONFIDENCE + contrastDiff / 255),
              notes: `隣接輝度差: ${contrastDiff.toFixed(1)}`,
            });
          }
        }
      }
    }

    return defects;
  }
}
