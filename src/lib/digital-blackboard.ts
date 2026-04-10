/**
 * Digital blackboard compositing logic for construction site photos.
 * Renders a blackboard overlay onto a canvas with project metadata.
 */

export type BlackboardData = {
  projectName: string;
  shootDate: string; // YYYY-MM-DD
  workType: string;
  location: string;
  condition: string;
};

export type BlackboardTemplate = {
  id: string;
  projectName: string;
  workType: string;
};

const BLACKBOARD_WIDTH_RATIO = 0.38;
const BLACKBOARD_HEIGHT_RATIO = 0.28;
const PADDING = 10;
const LINE_HEIGHT = 18;

/**
 * Draw the blackboard overlay onto an existing canvas context.
 * Blackboard is placed at the bottom-left of the canvas.
 */
export function drawBlackboard(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  data: BlackboardData
): void {
  const bw = Math.round(canvasWidth * BLACKBOARD_WIDTH_RATIO);
  const bh = Math.round(canvasHeight * BLACKBOARD_HEIGHT_RATIO);
  const bx = PADDING;
  const by = canvasHeight - bh - PADDING;

  // Board background
  ctx.fillStyle = "rgba(10, 40, 10, 0.88)";
  ctx.strokeStyle = "#f5c842";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  // Text settings
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  const titleFontSize = Math.max(10, Math.round(bh * 0.14));
  const bodyFontSize = Math.max(9, Math.round(bh * 0.11));

  // Title row
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  ctx.fillStyle = "#f5c842";
  drawTextClipped(ctx, "■ 電子黒板", bx + PADDING, by + PADDING, bw - PADDING * 2);

  const rows: [string, string][] = [
    ["工事名", data.projectName],
    ["撮影日", data.shootDate],
    ["工　種", data.workType],
    ["部　位", data.location],
    ["状　況", data.condition],
  ];

  ctx.font = `${bodyFontSize}px sans-serif`;
  let rowY = by + PADDING + titleFontSize + 4;
  const labelWidth = Math.round(bw * 0.28);

  for (const [label, value] of rows) {
    // Divider
    ctx.strokeStyle = "rgba(245,200,66,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(bx + PADDING, rowY);
    ctx.lineTo(bx + bw - PADDING, rowY);
    ctx.stroke();

    ctx.fillStyle = "#aad4aa";
    drawTextClipped(ctx, label, bx + PADDING, rowY + 2, labelWidth);

    ctx.fillStyle = "#ffffff";
    drawTextClipped(ctx, value, bx + PADDING + labelWidth + 4, rowY + 2, bw - PADDING * 2 - labelWidth - 4);

    rowY += LINE_HEIGHT;
    if (rowY + LINE_HEIGHT > by + bh - PADDING) break;
  }
}

function drawTextClipped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (maxWidth <= 0) return;
  let t = text;
  while (t.length > 0 && ctx.measureText(t).width > maxWidth) {
    t = t.slice(0, -1);
  }
  ctx.fillText(t, x, y);
}

/**
 * Composite a photo (HTMLImageElement) with a blackboard overlay onto a new canvas.
 * Returns the canvas element.
 */
export function compositeBlackboard(
  image: HTMLImageElement,
  data: BlackboardData
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(image, 0, 0);
  drawBlackboard(ctx, canvas.width, canvas.height, data);

  return canvas;
}

/**
 * Download a canvas as a JPEG file.
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL("image/jpeg", 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/** Persist templates to localStorage */
const STORAGE_KEY = "blackboard_templates";

export function loadTemplates(): BlackboardTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BlackboardTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplate(tpl: BlackboardTemplate): void {
  const templates = loadTemplates().filter((t) => t.id !== tpl.id);
  templates.unshift(tpl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 20)));
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
