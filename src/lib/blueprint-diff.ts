/**
 * Blueprint diff logic: compare two Canvas ImageData objects and produce
 * a colored overlay highlighting additions (blue), removals (red), and
 * general changes (yellow). Ported and rewritten from ~/blueprint-diff/.
 */

export type DiffColor = "added" | "removed" | "changed";

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiffRegion = {
  box: BoundingBox;
  type: DiffColor;
};

export type DiffResult = {
  /** RGBA ImageData to draw as overlay on a canvas */
  overlayData: ImageData;
  /** Fraction [0,1] of pixels that changed */
  diffRatio: number;
  /** Diff regions with bounding boxes for auto-pin placement */
  regions: DiffRegion[];
};

// ---- internal helpers ----

function toGray(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Resize ImageData to (W, H) with nearest-neighbour interpolation.
 */
function resizeNearest(
  src: ImageData,
  W: number,
  H: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  const scaleX = src.width / W;
  const scaleY = src.height / H;
  for (let y = 0; y < H; y++) {
    const srcY = Math.min(Math.floor(y * scaleY), src.height - 1);
    for (let x = 0; x < W; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), src.width - 1);
      const si = (srcY * src.width + srcX) * 4;
      const di = (y * W + x) * 4;
      out[di] = src.data[si]!;
      out[di + 1] = src.data[si + 1]!;
      out[di + 2] = src.data[si + 2]!;
      out[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Find connected bounding boxes of non-zero pixels in a mask via
 * single-pass row-labelling with union-find.
 */
function findBoundingBoxes(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number
): BoundingBox[] {
  const labels = new Int32Array(mask.length).fill(-1);
  const parent = new Int32Array(mask.length);
  let nextLabel = 0;

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };

  // First pass: assign provisional labels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const left = x > 0 ? labels[i - 1] : -1;
      const above = y > 0 ? labels[i - width] : -1;
      if (left === -1 && above === -1) {
        parent[nextLabel] = nextLabel;
        labels[i] = nextLabel++;
      } else if (left !== -1 && above === -1) {
        labels[i] = left;
      } else if (left === -1 && above !== -1) {
        labels[i] = above;
      } else {
        labels[i] = left!;
        union(left!, above!);
      }
    }
  }

  // Second pass: collect bounding boxes per root label
  const boxes = new Map<
    number,
    { x1: number; y1: number; x2: number; y2: number; count: number }
  >();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (labels[i] === -1) continue;
      const root = find(labels[i]!);
      const b = boxes.get(root);
      if (!b) {
        boxes.set(root, { x1: x, y1: y, x2: x, y2: y, count: 1 });
      } else {
        b.x1 = Math.min(b.x1, x);
        b.y1 = Math.min(b.y1, y);
        b.x2 = Math.max(b.x2, x);
        b.y2 = Math.max(b.y2, y);
        b.count++;
      }
    }
  }

  const result: BoundingBox[] = [];
  for (const b of boxes.values()) {
    if (b.count >= minArea) {
      result.push({
        x: b.x1,
        y: b.y1,
        width: b.x2 - b.x1 + 1,
        height: b.y2 - b.y1 + 1,
      });
    }
  }
  return result;
}

// ---- public API ----

/**
 * Compare two Canvas ImageData objects and return a colored diff overlay.
 *
 * Color coding:
 *   - Red   (#dc2626): content removed (ink in old, blank in new)
 *   - Blue  (#2563eb): content added   (blank in old, ink in new)
 *   - Yellow(#eab308): content changed (other differences)
 *
 * @param oldImageData  ImageData from the "before" drawing
 * @param newImageData  ImageData from the "after" drawing
 * @param threshold     per-channel difference threshold 0-255, default 30
 * @param minArea       minimum pixel area to report as a region, default 50
 */
export function comparePDFs(
  oldImageData: ImageData,
  newImageData: ImageData,
  threshold = 30,
  minArea = 50
): DiffResult {
  const W = newImageData.width;
  const H = newImageData.height;

  // Normalise old image to same dimensions as new
  const oldPixels: Uint8ClampedArray =
    oldImageData.width === W && oldImageData.height === H
      ? oldImageData.data
      : resizeNearest(oldImageData, W, H);
  const newPixels = newImageData.data;

  const changedMask = new Uint8Array(W * H);
  const addedMask = new Uint8Array(W * H);
  const removedMask = new Uint8Array(W * H);

  let changedCount = 0;

  for (let i = 0; i < W * H; i++) {
    const oi = i * 4;
    const or_ = oldPixels[oi]!;
    const og = oldPixels[oi + 1]!;
    const ob = oldPixels[oi + 2]!;
    const nr = newPixels[oi]!;
    const ng = newPixels[oi + 1]!;
    const nb = newPixels[oi + 2]!;

    const diff = Math.abs(or_ - nr) + Math.abs(og - ng) + Math.abs(ob - nb);
    if (diff > threshold * 3) {
      changedMask[i] = 1;
      changedCount++;

      // Classify pixel: ink = low gray (<128), blank = high gray (>200)
      const oldGray = toGray(or_, og, ob);
      const newGray = toGray(nr, ng, nb);
      if (newGray < 128 && oldGray > 200) {
        addedMask[i] = 1;
      } else if (oldGray < 128 && newGray > 200) {
        removedMask[i] = 1;
      }
    }
  }

  const diffRatio = changedCount / (W * H);

  // Build overlay RGBA (transparent where no change)
  const overlayData = new ImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const oi = i * 4;
    if (!changedMask[i]) {
      // fully transparent
      overlayData.data[oi + 3] = 0;
    } else if (removedMask[i]) {
      overlayData.data[oi] = 220;
      overlayData.data[oi + 1] = 38;
      overlayData.data[oi + 2] = 38;
      overlayData.data[oi + 3] = 200;
    } else if (addedMask[i]) {
      overlayData.data[oi] = 37;
      overlayData.data[oi + 1] = 99;
      overlayData.data[oi + 2] = 235;
      overlayData.data[oi + 3] = 200;
    } else {
      // yellow = other changes
      overlayData.data[oi] = 234;
      overlayData.data[oi + 1] = 179;
      overlayData.data[oi + 2] = 8;
      overlayData.data[oi + 3] = 200;
    }
  }

  // Extract bounding boxes for auto-pin placement
  const boxes = findBoundingBoxes(changedMask, W, H, minArea);
  const regions: DiffRegion[] = boxes.map((box) => {
    let addedCnt = 0;
    let removedCnt = 0;
    let changedCnt = 0;
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        const i = y * W + x;
        if (addedMask[i]) addedCnt++;
        else if (removedMask[i]) removedCnt++;
        else if (changedMask[i]) changedCnt++;
      }
    }
    const max = Math.max(addedCnt, removedCnt, changedCnt);
    const type: DiffColor =
      max === addedCnt
        ? "added"
        : max === removedCnt
        ? "removed"
        : "changed";
    return { box, type };
  });

  return { overlayData, diffRatio, regions };
}
