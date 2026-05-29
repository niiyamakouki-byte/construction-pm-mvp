/**
 * パス抽出
 *
 * PDFPageProxy.getOperatorList() を走査し、構築パス（moveTo/lineTo/rectangle/curveTo）を
 * 現在の CTM（save/restore/transform で管理）と線幅を適用して RawSeg[] へ変換する。
 *
 * ベジエ（curveTo）は curve-fitter に弦分割を委譲するため、ここでは
 * 制御点付きの「ベジエグループ」として収集し flattenBezier で展開する。
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfArc, Point } from "../pdf-to-estimate/types.js";
import type { RawSeg } from "./raw-types.js";
import { flattenBezier } from "./curve-fitter.js";

const OPS = pdfjs.OPS;
const ARC_RADIUS_REL_TOL = 0.12;
const ARC_TANGENT_COS_TOL = 0.3;
const ARC_SWEEP_MIN_RAD = Math.PI / 4;
const ARC_SWEEP_MAX_RAD = (3 * Math.PI) / 4;

/** 2x3 アフィン行列 [a,b,c,d,e,f] を点に適用する。 */
function applyMatrix(m: number[], p: Point): Point {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

/** 行列の合成 m1 ∘ m2（m2 を先に適用）。 */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** 行列の平均スケール（線幅変換用）。 */
function matrixScale(m: number[]): number {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[2], m[3]);
  return (sx + sy) / 2;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cubicAt(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

function normalizeSweep(startAngle: number, endAngle: number, ccw: boolean): number {
  let sweep = endAngle - startAngle;
  if (ccw) {
    while (sweep <= 0) sweep += Math.PI * 2;
  } else {
    while (sweep >= 0) sweep -= Math.PI * 2;
  }
  return sweep;
}

function fitArcFromBezier(p0: Point, c1: Point, c2: Point, p3: Point): PdfArc | null {
  const tan0 = sub(c1, p0);
  const tan1 = sub(p3, c2);
  const tan0Len = Math.hypot(tan0.x, tan0.y);
  const tan1Len = Math.hypot(tan1.x, tan1.y);
  if (tan0Len < 1e-6 || tan1Len < 1e-6) return null;

  const n0: Point = { x: -tan0.y, y: tan0.x };
  const n1: Point = { x: -tan1.y, y: tan1.x };
  const denom = cross(n0, n1);
  if (Math.abs(denom) < 1e-6) return null;

  const delta = sub(p3, p0);
  const factor = cross(delta, n1) / denom;
  const center = { x: p0.x + n0.x * factor, y: p0.y + n0.y * factor };

  const r0 = dist(center, p0);
  const r1 = dist(center, p3);
  const rm = dist(center, cubicAt(p0, c1, c2, p3, 0.5));
  const radius = (r0 + r1 + rm) / 3;
  if (radius < 1e-6) return null;

  const maxRelErr = Math.max(
    Math.abs(r0 - radius),
    Math.abs(r1 - radius),
    Math.abs(rm - radius),
  ) / radius;
  if (maxRelErr > ARC_RADIUS_REL_TOL) return null;

  const radial0 = sub(p0, center);
  const radial1 = sub(p3, center);
  const tan0Cos = Math.abs(dot(radial0, tan0)) / (Math.hypot(radial0.x, radial0.y) * tan0Len);
  const tan1Cos = Math.abs(dot(radial1, tan1)) / (Math.hypot(radial1.x, radial1.y) * tan1Len);
  if (tan0Cos > ARC_TANGENT_COS_TOL || tan1Cos > ARC_TANGENT_COS_TOL) return null;

  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);
  const ccw = cross(radial0, tan0) > 0;
  const sweep = normalizeSweep(startAngle, endAngle, ccw);
  if (Math.abs(sweep) < ARC_SWEEP_MIN_RAD || Math.abs(sweep) > ARC_SWEEP_MAX_RAD) return null;

  return {
    center,
    radius,
    start_angle: startAngle,
    end_angle: startAngle + sweep,
  };
}

function curveToSegments(
  start: Point,
  c1: Point,
  c2: Point,
  end: Point,
  widthPt: number,
): RawSeg[] {
  const arc = fitArcFromBezier(start, c1, c2, end);
  if (arc) return [{ start, end, width: widthPt, arc }];
  return flattenBezier(start, c1, c2, end).map((chord) => ({ ...chord, width: widthPt }));
}

const IDENTITY = [1, 0, 0, 1, 0, 0];

/**
 * ページから直線・矩形・ベジエ弦を RawSeg[] として抽出する。
 */
export async function extractRawSegments(page: PDFPageProxy): Promise<RawSeg[]> {
  const opList = await page.getOperatorList();
  const fnArray = opList.fnArray;
  const argsArray = opList.argsArray;

  const segs: RawSeg[] = [];

  // グラフィックス状態スタック
  let ctm = [...IDENTITY];
  let lineWidth = 1;
  const stack: { ctm: number[]; lineWidth: number }[] = [];

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    switch (fn) {
      case OPS.save:
        stack.push({ ctm: [...ctm], lineWidth });
        break;
      case OPS.restore: {
        const prev = stack.pop();
        if (prev) {
          ctm = prev.ctm;
          lineWidth = prev.lineWidth;
        }
        break;
      }
      case OPS.transform:
        // args = [a,b,c,d,e,f]
        ctm = multiply(ctm, args as number[]);
        break;
      case OPS.setLineWidth:
        lineWidth = args[0] as number;
        break;
      case OPS.constructPath:
        collectPath(args, ctm, lineWidth, segs);
        break;
      default:
        break;
    }
  }

  return segs;
}

/**
 * constructPath の引数を展開してセグメントを収集する。
 * args = [opsArray, coordsArray]（pdf.js v4 形式）。座標は device 前の user 空間。
 */
function collectPath(
  args: unknown[],
  ctm: number[],
  lineWidth: number,
  out: RawSeg[],
): void {
  const pathOps = args[0] as number[];
  const coords = args[1] as number[];
  const widthPt = (lineWidth || 0) * matrixScale(ctm);

  let ci = 0;
  let current: Point | null = null;
  let subpathStart: Point | null = null;

  const tx = (x: number, y: number): Point => applyMatrix(ctm, { x, y });

  for (const op of pathOps) {
    switch (op) {
      case OPS.moveTo: {
        current = tx(coords[ci++], coords[ci++]);
        subpathStart = current;
        break;
      }
      case OPS.lineTo: {
        const next = tx(coords[ci++], coords[ci++]);
        if (current) out.push({ start: current, end: next, width: widthPt });
        current = next;
        break;
      }
      case OPS.curveTo: {
        // 3 制御点 + 終点 = 6 値。始点は current。
        const c1 = tx(coords[ci++], coords[ci++]);
        const c2 = tx(coords[ci++], coords[ci++]);
        const end = tx(coords[ci++], coords[ci++]);
        if (current) {
          for (const seg of curveToSegments(current, c1, c2, end, widthPt)) {
            out.push(seg);
          }
        }
        current = end;
        break;
      }
      case OPS.curveTo2: {
        // 終点が第2制御点と一致するケース（始点・c1・end の 2 点指定）
        const c1 = current!;
        const c2 = tx(coords[ci++], coords[ci++]);
        const end = tx(coords[ci++], coords[ci++]);
        if (current) {
          for (const seg of curveToSegments(current, c1, c2, end, widthPt)) {
            out.push(seg);
          }
        }
        current = end;
        break;
      }
      case OPS.curveTo3: {
        const c1 = tx(coords[ci++], coords[ci++]);
        const end = tx(coords[ci++], coords[ci++]);
        const c2 = end;
        if (current) {
          for (const seg of curveToSegments(current, c1, c2, end, widthPt)) {
            out.push(seg);
          }
        }
        current = end;
        break;
      }
      case OPS.rectangle: {
        const x = coords[ci++];
        const y = coords[ci++];
        const w = coords[ci++];
        const h = coords[ci++];
        const p0 = tx(x, y);
        const p1 = tx(x + w, y);
        const p2 = tx(x + w, y + h);
        const p3 = tx(x, y + h);
        out.push({ start: p0, end: p1, width: widthPt });
        out.push({ start: p1, end: p2, width: widthPt });
        out.push({ start: p2, end: p3, width: widthPt });
        out.push({ start: p3, end: p0, width: widthPt });
        current = p0;
        subpathStart = p0;
        break;
      }
      case OPS.closePath: {
        if (current && subpathStart) {
          out.push({ start: current, end: subpathStart, width: widthPt });
          current = subpathStart;
        }
        break;
      }
      default:
        break;
    }
  }
}
