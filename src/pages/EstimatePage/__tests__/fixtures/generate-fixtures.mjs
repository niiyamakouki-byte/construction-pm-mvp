/**
 * Synthetic floor-plan PDF fixture generator for the PDF→estimate robustness audit.
 *
 * Run from repo root:  node src/pages/EstimatePage/__tests__/fixtures/generate-fixtures.mjs
 *
 * Wall-detection rule (interior-semantic.isWallLine): length_mm >= 500 AND thickness >= 0.5pt.
 * Scale detection (scale-detector): regex /1\s*[:/]\s*(\d+)/ on any text → ratio * (25.4/72) mm/pt.
 *   1/50  → scale_mm_per_pt ≈ 17.6389
 *   1/100 → scale_mm_per_pt ≈ 35.2778
 *
 * jsPDF uses a top-left origin (y grows down) in pt. pdf.js flips to bottom-left user space,
 * but lengths/areas are flip-invariant (shoelace uses Math.abs), so geometry is preserved.
 *
 * Each generator returns { name, expected } so the spec can assert against draw-derived truth.
 */
import { jsPDF } from "jspdf";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WALL_W = 2; // pt line width → thickness >= 0.5pt OK
const PT_TO_MM = 25.4 / 72;

/** Draw a polyline of wall segments (array of [x,y] pt points; closed if `close`). */
function drawPolyWalls(doc, pts, close) {
  doc.setLineWidth(WALL_W);
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  if (close) {
    const a = pts[pts.length - 1];
    const b = pts[0];
    doc.line(a[0], a[1], b[0], b[1]);
  }
}

/** Shoelace area (pt²) for a closed polygon of [x,y] points. */
function polyAreaPt2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(a) / 2;
}

function areaSqM(pts, mmPerPt) {
  return (polyAreaPt2(pts) * mmPerPt * mmPerPt) / 1_000_000;
}

function newDoc() {
  return new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
}

// ── Fixture 1: multi-room (two adjacent rooms sharing a wall) ──────────────
function multiRoom() {
  const doc = newDoc();
  const mmPerPt = 50 * PT_TO_MM;
  doc.setFontSize(12);
  doc.text("S=1/50", 40, 30);
  // Room A (事務室): x 100..300, y 100..300  (200x200 pt)
  // Room B (会議室): x 300..500, y 100..300  (200x200 pt), shares x=300 wall
  const roomA = [[100, 100], [300, 100], [300, 300], [100, 300]];
  const roomB = [[300, 100], [500, 100], [500, 300], [300, 300]];
  drawPolyWalls(doc, roomA, true);
  drawPolyWalls(doc, roomB, true);
  doc.text("事務室", 170, 205);
  doc.text("会議室", 370, 205);
  return {
    name: "floorplan-multiroom-1-50.pdf",
    buf: Buffer.from(doc.output("arraybuffer")),
    expected: {
      mmPerPt,
      roomA_m2: areaSqM(roomA, mmPerPt),
      roomB_m2: areaSqM(roomB, mmPerPt),
      sum_m2: areaSqM(roomA, mmPerPt) + areaSqM(roomB, mmPerPt),
    },
  };
}

// ── Fixture 2: L-shaped (non-convex) room as connected wall segments ───────
function lShaped() {
  const doc = newDoc();
  const mmPerPt = 50 * PT_TO_MM;
  doc.setFontSize(12);
  doc.text("S=1/50", 40, 30);
  // L outline (clockwise), 6 vertices:
  //   (100,100)->(400,100)->(400,250)->(250,250)->(250,400)->(100,400)->close
  const poly = [
    [100, 100], [400, 100], [400, 250],
    [250, 250], [250, 400], [100, 400],
  ];
  drawPolyWalls(doc, poly, true);
  doc.text("倉庫", 150, 200);
  return {
    name: "floorplan-lshaped-1-50.pdf",
    buf: Buffer.from(doc.output("arraybuffer")),
    expected: { mmPerPt, area_m2: areaSqM(poly, mmPerPt) },
  };
}

// ── Fixture 3: single room at 1/100 (same pt dims as a 1/50 single room) ───
function scale100() {
  const doc = newDoc();
  const mmPerPt = 100 * PT_TO_MM;
  doc.setFontSize(12);
  doc.text("S=1/100", 40, 30);
  // Same 200x200 pt rect as multiroom Room A
  const room = [[100, 100], [300, 100], [300, 300], [100, 300]];
  drawPolyWalls(doc, room, true);
  doc.text("事務室", 170, 205);
  return {
    name: "floorplan-single-1-100.pdf",
    buf: Buffer.from(doc.output("arraybuffer")),
    expected: { mmPerPt, area_m2: areaSqM(room, mmPerPt) },
  };
}

// ── Fixture 4: rectangular room rotated ~30° ───────────────────────────────
function rotated() {
  const doc = newDoc();
  const mmPerPt = 50 * PT_TO_MM;
  doc.setFontSize(12);
  doc.text("S=1/50", 40, 30);
  const cx = 350, cy = 250;
  const w = 240, h = 160; // pt
  const th = (30 * Math.PI) / 180;
  const cos = Math.cos(th), sin = Math.sin(th);
  const corners = [
    [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
  drawPolyWalls(doc, corners, true);
  doc.text("会議室", cx - 20, cy);
  return {
    name: "floorplan-rotated-1-50.pdf",
    buf: Buffer.from(doc.output("arraybuffer")),
    // True rect area is flip/rotation invariant: w*h pt²
    expected: { mmPerPt, area_m2: areaSqM(corners, mmPerPt) },
  };
}

const fixtures = [multiRoom(), lShaped(), scale100(), rotated()];
for (const f of fixtures) {
  writeFileSync(resolve(HERE, f.name), f.buf);
  // eslint-disable-next-line no-console
  console.log(`wrote ${f.name} (${f.buf.length} bytes)  expected=`, JSON.stringify(f.expected));
}
