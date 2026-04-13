/**
 * Photo Classifier — 蔵衛門蒸留 (Comprehensive)
 * AI-powered automatic photo classification for construction site photos.
 * Analyzes filenames and metadata to categorize by work type, location, and phase.
 */

import { escapeHtml } from "./utils/escape-html.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PhotoCategory =
  | "foundation"
  | "framing"
  | "mep_rough"
  | "mep_finish"
  | "interior_rough"
  | "interior_finish"
  | "exterior"
  | "waterproof"
  | "safety"
  | "progress"
  | "defect"
  | "material"
  | "equipment"
  | "other";

export type PhotoClassification = {
  category: PhotoCategory;
  confidence: number; // 0.0 – 1.0
  subcategory?: string;
  tags: string[];
};

export type ClassifiedPhoto = {
  id: string;
  filename: string;
  takenAt: Date;
  projectId: string;
  classification: PhotoClassification;
  location?: string;
  floor?: number;
  room?: string;
  note?: string;
};

export type PhotoAlbum = {
  id: string;
  projectId: string;
  name: string;
  category: PhotoCategory;
  photos: ClassifiedPhoto[];
  createdAt: Date;
};

export type PhotoSortRule = {
  pattern: RegExp | string;
  category: PhotoCategory;
  subcategory?: string;
  tags: string[];
};

export type PhotoMetadata = {
  filename: string;
  takenAt?: Date;
  exifData?: {
    DateTimeOriginal?: string;
    GPSLatitude?: number;
    GPSLongitude?: number;
    GPSAltitude?: number;
    Make?: string;
    Model?: string;
    [key: string]: unknown;
  };
};

export type PhotoStats = {
  total: number;
  byCategory: Record<PhotoCategory, number>;
  dateRange: { earliest: Date | null; latest: Date | null };
  byFloor: Record<number, number>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s_\-./]/g, "");
}

function scoreText(text: string, keywords: string[]): number {
  const normalized = normalize(text);
  let score = 0;
  for (const kw of keywords) {
    if (normalized.includes(normalize(kw))) {
      score += kw.length;
    }
  }
  return score;
}

function extractFloor(filename: string): number | undefined {
  // Match patterns like 3F, B1, 3階, B1F, 地下1
  const floorMatch = filename.match(/(?:B(\d+)F?|(\d+)F|(\d+)階|地下(\d+))/i);
  if (!floorMatch) return undefined;
  if (floorMatch[1]) return -parseInt(floorMatch[1], 10); // basement
  if (floorMatch[2]) return parseInt(floorMatch[2], 10);
  if (floorMatch[3]) return parseInt(floorMatch[3], 10);
  if (floorMatch[4]) return -parseInt(floorMatch[4], 10);
  return undefined;
}

function extractTags(filename: string, rules: PhotoSortRule[]): string[] {
  const tags = new Set<string>();
  const lower = filename.toLowerCase();

  // Floor tags
  const floor = extractFloor(filename);
  if (floor !== undefined) {
    tags.add(floor < 0 ? `B${Math.abs(floor)}F` : `${floor}F`);
  }

  // Before/after tags
  if (/before|施工前|着工前|解体前/i.test(lower)) tags.add("before");
  if (/after|施工後|完成後|竣工/i.test(lower)) tags.add("after");

  // Inspection tags
  if (/検査|inspection/i.test(lower)) tags.add("inspection");

  // Collect tags from matching rules
  for (const rule of rules) {
    const pattern =
      typeof rule.pattern === "string" ? new RegExp(rule.pattern, "i") : rule.pattern;
    if (pattern.test(filename)) {
      for (const tag of rule.tags) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}

// ── Default Sort Rules ────────────────────────────────────────────────────────

export function getDefaultSortRules(): PhotoSortRule[] {
  return [
    // foundation
    {
      pattern: /基礎|杭|根切|土工|根伐|ベース|フーチング|地業|地盤|杭打|杭頭|鉄筋コンクリート基礎/,
      category: "foundation",
      subcategory: "concrete_foundation",
      tags: ["foundation"],
    },
    // framing
    {
      pattern: /躯体|配筋|型枠|コンクリ|スラブ|梁|柱|剪断|耐震|鉄筋|鉄骨|骨組|フレーム|ラーメン/,
      category: "framing",
      subcategory: "structural_frame",
      tags: ["framing"],
    },
    // mep_rough
    {
      pattern: /配管|配線|ダクト|スリーブ|鞘管|給排水管|電気配管|空調ダクト|設備rough|設備下地/,
      category: "mep_rough",
      subcategory: "mechanical_rough",
      tags: ["mep", "rough"],
    },
    // mep_finish
    {
      pattern: /器具|照明|スイッチ|コンセント|衛生器具|空調機|FCU|AHU|盤|分電盤|弱電|インターホン/,
      category: "mep_finish",
      subcategory: "mechanical_finish",
      tags: ["mep", "finish"],
    },
    // interior_rough
    {
      pattern: /下地|ボード|LGS|軽鉄|スタッド|石膏|パテ|墨出|断熱|グラスウール/,
      category: "interior_rough",
      subcategory: "substrate",
      tags: ["interior", "rough"],
    },
    // interior_finish
    {
      pattern: /クロス|塗装|床|タイル|フローリング|カーペット|仕上|長尺|CF|壁紙|内装仕上/,
      category: "interior_finish",
      subcategory: "finish_work",
      tags: ["interior", "finish"],
    },
    // exterior
    {
      pattern: /外壁タイル|外壁工事|外壁仕上|外壁|屋根|サッシ|外装|ファサード|外観|外構|タイル外壁|ALC|EPS|外断熱/,
      category: "exterior",
      subcategory: "facade",
      tags: ["exterior"],
    },
    // waterproof
    {
      pattern: /防水|シーリング|コーキング|止水|ウレタン防水|FRP防水|アスファルト防水|シート防水/,
      category: "waterproof",
      subcategory: "waterproofing",
      tags: ["waterproof"],
    },
    // safety
    {
      pattern: /安全|KY|朝礼|ヘルメット|安全帯|保護具|危険|警告|安全確認|安全パトロール|TBM/,
      category: "safety",
      subcategory: "safety_management",
      tags: ["safety"],
    },
    // progress
    {
      pattern: /全景|進捗|全体|俯瞰|遠景|ドローン|空撮|工事状況|施工状況|現場全景/,
      category: "progress",
      subcategory: "site_overview",
      tags: ["progress"],
    },
    // defect
    {
      pattern: /是正箇所|手直し|是正|手直|ダメ|不良|欠陥|クレーム|補修|修繕|ひび割|クラック|漏水|結露/,
      category: "defect",
      subcategory: "defect_correction",
      tags: ["defect"],
    },
    // material
    {
      pattern: /搬入|材料|資材|荷受|荷降|納品|在庫|鋼材|木材|コンクリート材料|材料検収/,
      category: "material",
      subcategory: "material_delivery",
      tags: ["material"],
    },
    // equipment
    {
      pattern: /重機|クレーン|ポンプ車|建機|足場|仮設|養生|型枠脱型|タワークレーン|バックホウ/,
      category: "equipment",
      subcategory: "construction_equipment",
      tags: ["equipment"],
    },
  ];
}

// ── Core Classification ───────────────────────────────────────────────────────

/**
 * classifyByFilename — Classify photo based on filename patterns.
 * Returns PhotoClassification with confidence score.
 */
export function classifyByFilename(filename: string): PhotoClassification {
  const rules = getDefaultSortRules();
  return classifyWithRules(filename, rules);
}

function classifyWithRules(filename: string, rules: PhotoSortRule[]): PhotoClassification {
  let bestCategory: PhotoCategory = "other";
  let bestScore = 0;
  let bestSubcategory: string | undefined;
  let bestRuleTags: string[] = [];

  for (const rule of rules) {
    // Use global flag to sum all match lengths in the filename
    const src = typeof rule.pattern === "string" ? rule.pattern : rule.pattern.source;
    const globalPattern = new RegExp(src, "gi");
    const allMatches = Array.from(filename.matchAll(globalPattern));
    if (allMatches.length === 0) continue;

    // Score = total length of all matched text segments
    const matchScore = allMatches.reduce((sum, m) => sum + m[0].length, 0);
    if (matchScore >= bestScore) {
      bestScore = matchScore;
      bestCategory = rule.category;
      bestSubcategory = rule.subcategory;
      bestRuleTags = rule.tags;
    }
  }

  // Also do keyword scoring for confidence calculation
  const allKeywords = rules.flatMap((r) => {
    const pat = typeof r.pattern === "string" ? r.pattern : r.pattern.source;
    return pat.split("|");
  });
  const totalPossibleScore = allKeywords.reduce((max, kw) => Math.max(max, kw.length), 0);
  const confidence =
    bestScore === 0 ? 0 : Math.min(1.0, parseFloat((bestScore / totalPossibleScore).toFixed(2)));

  const tags = extractTags(filename, rules);
  // Merge rule-matched tags
  for (const t of bestRuleTags) {
    if (!tags.includes(t)) tags.push(t);
  }

  const result: PhotoClassification = {
    category: bestCategory,
    confidence,
    tags,
  };
  if (bestSubcategory) result.subcategory = bestSubcategory;
  return result;
}

/**
 * classifyByMetadata — Enhanced classification using EXIF data.
 * Uses date for phase estimation and GPS for location hints.
 */
export function classifyByMetadata(metadata: PhotoMetadata): PhotoClassification {
  const base = classifyByFilename(metadata.filename);

  // Boost confidence slightly when EXIF data is present
  const hasExif = metadata.exifData && Object.keys(metadata.exifData).length > 0;
  if (hasExif && base.confidence > 0) {
    base.confidence = Math.min(1.0, parseFloat((base.confidence + 0.1).toFixed(2)));
  }

  // Add GPS tag if GPS data is present
  if (metadata.exifData?.GPSLatitude !== undefined && metadata.exifData.GPSLongitude !== undefined) {
    if (!base.tags.includes("gps")) {
      base.tags.push("gps");
    }
  }

  // Add date-based tags
  const dateStr = metadata.exifData?.DateTimeOriginal ?? metadata.takenAt?.toISOString();
  if (dateStr) {
    const date = new Date(dateStr as string);
    if (!isNaN(date.getTime())) {
      const month = date.getMonth() + 1;
      // Rough phase estimation by month (typical Japanese construction calendar)
      if (month >= 4 && month <= 6) {
        if (!base.tags.includes("phase:spring")) base.tags.push("phase:spring");
      } else if (month >= 7 && month <= 9) {
        if (!base.tags.includes("phase:summer")) base.tags.push("phase:summer");
      } else if (month >= 10 && month <= 12) {
        if (!base.tags.includes("phase:autumn")) base.tags.push("phase:autumn");
      } else {
        if (!base.tags.includes("phase:winter")) base.tags.push("phase:winter");
      }
    }
  }

  return base;
}

// ── Batch Operations ──────────────────────────────────────────────────────────

/**
 * autoSortPhotos — Batch classify an array of photos.
 */
export function autoSortPhotos(
  photos: Array<{
    id: string;
    filename: string;
    takenAt: Date;
    projectId: string;
    location?: string;
    floor?: number;
    room?: string;
    note?: string;
  }>,
  rules?: PhotoSortRule[],
): ClassifiedPhoto[] {
  const effectiveRules = rules ?? getDefaultSortRules();
  return photos.map((photo) => {
    const classification = classifyWithRules(photo.filename, effectiveRules);
    const floor = photo.floor ?? extractFloor(photo.filename);
    const result: ClassifiedPhoto = {
      ...photo,
      classification,
    };
    if (floor !== undefined) result.floor = floor;
    return result;
  });
}

// ── Grouping Functions ────────────────────────────────────────────────────────

/**
 * groupPhotosByCategory — Group classified photos by category.
 */
export function groupPhotosByCategory(
  photos: ClassifiedPhoto[],
): Record<PhotoCategory, ClassifiedPhoto[]> {
  const result = {} as Record<PhotoCategory, ClassifiedPhoto[]>;
  for (const photo of photos) {
    const cat = photo.classification.category;
    if (!result[cat]) result[cat] = [];
    result[cat].push(photo);
  }
  return result;
}

/**
 * groupPhotosByDate — Group by date (YYYY-MM-DD).
 */
export function groupPhotosByDate(photos: ClassifiedPhoto[]): Record<string, ClassifiedPhoto[]> {
  const result: Record<string, ClassifiedPhoto[]> = {};
  for (const photo of photos) {
    const key = photo.takenAt.toISOString().slice(0, 10);
    if (!result[key]) result[key] = [];
    result[key].push(photo);
  }
  return result;
}

/**
 * groupPhotosByFloor — Group by floor number.
 */
export function groupPhotosByFloor(photos: ClassifiedPhoto[]): Record<number, ClassifiedPhoto[]> {
  const result: Record<number, ClassifiedPhoto[]> = {};
  for (const photo of photos) {
    const floor = photo.floor;
    if (floor === undefined) continue;
    if (!result[floor]) result[floor] = [];
    result[floor].push(photo);
  }
  return result;
}

// ── Album Operations ──────────────────────────────────────────────────────────

/**
 * createAlbumFromGroup — Create a PhotoAlbum from a group of photos.
 */
export function createAlbumFromGroup(
  projectId: string,
  name: string,
  category: PhotoCategory,
  photos: ClassifiedPhoto[],
): PhotoAlbum {
  return {
    id: `album_${projectId}_${category}_${Date.now()}`,
    projectId,
    name,
    category,
    photos,
    createdAt: new Date(),
  };
}

// ── HTML Index Generation ─────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  foundation: "基礎工事",
  framing: "躯体工事",
  mep_rough: "設備下地",
  mep_finish: "設備仕上",
  interior_rough: "内装下地",
  interior_finish: "内装仕上",
  exterior: "外装工事",
  waterproof: "防水工事",
  safety: "安全管理",
  progress: "進捗写真",
  defect: "是正箇所",
  material: "材料搬入",
  equipment: "重機・仮設",
  other: "その他",
};

/**
 * generatePhotoIndex — Generate a printable HTML index of all albums.
 */
export function generatePhotoIndex(albums: PhotoAlbum[]): string {
  const albumRows = albums
    .map((album) => {
      const photoCount = album.photos.length;
      const dates = album.photos.map((p) => p.takenAt.getTime()).filter((d) => !isNaN(d));
      const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
      const latest = dates.length > 0 ? new Date(Math.max(...dates)) : null;
      const dateRange =
        earliest && latest
          ? `${earliest.toISOString().slice(0, 10)} 〜 ${latest.toISOString().slice(0, 10)}`
          : "—";

      const label = CATEGORY_LABELS[album.category] ?? album.category;

      return `    <tr>
      <td class="album-name">${escapeHtml(album.name)}</td>
      <td class="album-category">${escapeHtml(label)}</td>
      <td class="album-count">${escapeHtml(photoCount)}</td>
      <td class="album-date-range">${escapeHtml(dateRange)}</td>
      <td class="album-thumbnail">[thumbnail placeholder]</td>
    </tr>`;
    })
    .join("\n");

  const totalPhotos = albums.reduce((sum, a) => sum + a.photos.length, 0);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml("工事写真台帳")}</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    h1 { font-size: 1.5rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 1rem; text-align: left; }
    th { background: #f0f0f0; }
    .album-count { text-align: right; }
  </style>
</head>
<body>
  <h1>${escapeHtml("工事写真台帳インデックス")}</h1>
  <p>${escapeHtml(`アルバム数: ${albums.length} / 合計写真枚数: ${totalPhotos}`)}</p>
  <table>
    <thead>
      <tr>
        <th>アルバム名</th>
        <th>カテゴリ</th>
        <th>枚数</th>
        <th>撮影期間</th>
        <th>サムネイル</th>
      </tr>
    </thead>
    <tbody>
${albumRows}
    </tbody>
  </table>
</body>
</html>`;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * searchPhotos — Search photos by filename, tags, category, location, note.
 */
export function searchPhotos(photos: ClassifiedPhoto[], query: string): ClassifiedPhoto[] {
  if (!query.trim()) return photos;
  const q = query.toLowerCase();
  return photos.filter((photo) => {
    if (photo.filename.toLowerCase().includes(q)) return true;
    if (photo.classification.category.toLowerCase().includes(q)) return true;
    if (photo.classification.subcategory?.toLowerCase().includes(q)) return true;
    if (photo.classification.tags.some((t) => t.toLowerCase().includes(q))) return true;
    if (photo.location?.toLowerCase().includes(q)) return true;
    if (photo.note?.toLowerCase().includes(q)) return true;
    if (photo.room?.toLowerCase().includes(q)) return true;
    return false;
  });
}

// ── Statistics ────────────────────────────────────────────────────────────────

/**
 * getPhotoStats — Statistics: total count, by category, by date range, by floor.
 */
export function getPhotoStats(photos: ClassifiedPhoto[]): PhotoStats {
  const byCategory = {} as Record<PhotoCategory, number>;
  const byFloor: Record<number, number> = {};
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const photo of photos) {
    const cat = photo.classification.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;

    if (photo.floor !== undefined) {
      byFloor[photo.floor] = (byFloor[photo.floor] ?? 0) + 1;
    }

    const t = photo.takenAt.getTime();
    if (!isNaN(t)) {
      if (!earliest || t < earliest.getTime()) earliest = photo.takenAt;
      if (!latest || t > latest.getTime()) latest = photo.takenAt;
    }
  }

  return {
    total: photos.length,
    byCategory,
    dateRange: { earliest, latest },
    byFloor,
  };
}

// ── Duplicate Detection ───────────────────────────────────────────────────────

/**
 * detectDuplicates — Find potential duplicate photos
 * (same filename pattern + same timestamp within 5 seconds).
 */
export function detectDuplicates(photos: ClassifiedPhoto[]): ClassifiedPhoto[][] {
  const duplicateGroups: ClassifiedPhoto[][] = [];
  const seen = new Set<string>();

  // Normalize filename to strip sequence numbers for pattern matching
  function normalizeFilename(filename: string): string {
    return filename
      .replace(/\.\w+$/, "") // remove extension
      .replace(/[-_]\d{3,}$/, "") // remove trailing sequence numbers
      .replace(/\d{4,}/g, ""); // remove long number sequences (timestamps)
  }

  const FIVE_SECONDS = 5000;

  for (let i = 0; i < photos.length; i++) {
    if (seen.has(photos[i].id)) continue;
    const group: ClassifiedPhoto[] = [photos[i]];

    for (let j = i + 1; j < photos.length; j++) {
      if (seen.has(photos[j].id)) continue;
      const samePattern =
        normalizeFilename(photos[i].filename) === normalizeFilename(photos[j].filename);
      const timeDiff = Math.abs(photos[i].takenAt.getTime() - photos[j].takenAt.getTime());
      const sameTimestamp = timeDiff <= FIVE_SECONDS;

      if (samePattern && sameTimestamp) {
        group.push(photos[j]);
        seen.add(photos[j].id);
      }
    }

    if (group.length > 1) {
      seen.add(photos[i].id);
      duplicateGroups.push(group);
    }
  }

  return duplicateGroups;
}

// ── Missing Photo Suggestions ─────────────────────────────────────────────────

type ProjectType = "interior" | "new_build" | "renovation";

const REQUIRED_CATEGORIES: Record<ProjectType, Array<{ category: PhotoCategory; label: string }>> =
  {
    interior: [
      { category: "interior_rough", label: "内装下地写真がありません" },
      { category: "interior_finish", label: "内装仕上写真がありません" },
      { category: "mep_rough", label: "設備下地写真がありません" },
      { category: "mep_finish", label: "設備仕上写真がありません" },
      { category: "waterproof", label: "防水写真がありません" },
      { category: "safety", label: "安全管理写真がありません" },
      { category: "progress", label: "進捗写真がありません" },
    ],
    new_build: [
      { category: "foundation", label: "基礎工事写真がありません" },
      { category: "framing", label: "躯体工事写真がありません" },
      { category: "waterproof", label: "防水写真がありません" },
      { category: "exterior", label: "外装工事写真がありません" },
      { category: "mep_rough", label: "設備下地写真がありません" },
      { category: "mep_finish", label: "設備仕上写真がありません" },
      { category: "interior_rough", label: "内装下地写真がありません" },
      { category: "interior_finish", label: "内装仕上写真がありません" },
      { category: "safety", label: "安全管理写真がありません" },
      { category: "progress", label: "進捗写真がありません" },
    ],
    renovation: [
      { category: "interior_rough", label: "内装下地写真がありません" },
      { category: "interior_finish", label: "内装仕上写真がありません" },
      { category: "waterproof", label: "防水写真がありません" },
      { category: "mep_rough", label: "設備下地写真がありません" },
      { category: "mep_finish", label: "設備仕上写真がありません" },
      { category: "defect", label: "是正写真がありません" },
      { category: "safety", label: "安全管理写真がありません" },
      { category: "progress", label: "進捗写真がありません" },
    ],
  };

/**
 * suggestMissingPhotos — Suggest missing photo categories based on project type.
 */
export function suggestMissingPhotos(
  photos: ClassifiedPhoto[],
  projectType: ProjectType,
): string[] {
  const presentCategories = new Set(photos.map((p) => p.classification.category));
  const required = REQUIRED_CATEGORIES[projectType];
  return required
    .filter((req) => !presentCategories.has(req.category))
    .map((req) => req.label);
}

// ── Legacy API (backward compatibility) ──────────────────────────────────────
// Preserved for PhotoGrid.tsx and other consumers that use the original API.

/** @deprecated Use classifyByFilename instead */
export type LegacyPhotoCategory =
  | "外観"
  | "内装"
  | "設備"
  | "構造"
  | "仕上げ"
  | "安全"
  | "搬入"
  | "その他";

/** @deprecated Use PhotoClassification instead */
export type BeforeAfterLabel = "before" | "after" | null;

/** @deprecated Use PhotoClassification instead */
export type ClassificationResult = {
  category: LegacyPhotoCategory;
  beforeAfter: BeforeAfterLabel;
};

/** @deprecated Use PhotoMetadata instead */
export type PhotoClassifyInput = {
  fileName: string;
  capturedAt?: string;
  exifData?: Record<string, unknown>;
};

const LEGACY_CATEGORY_RULES: Array<{ keywords: string[]; category: LegacyPhotoCategory }> = [
  {
    keywords: ["外観", "外壁", "facade", "exterior", "外装", "屋根", "roof", "front", "正面"],
    category: "外観",
  },
  {
    keywords: ["内装", "interior", "室内", "内部", "floor", "床", "天井", "ceiling", "壁", "wall"],
    category: "内装",
  },
  {
    keywords: ["設備", "equipment", "電気", "electric", "配管", "pipe", "空調", "hvac", "換気", "ventilation"],
    category: "設備",
  },
  {
    keywords: ["構造", "structure", "基礎", "foundation", "鉄骨", "steel", "コンクリ", "concrete", "骨組", "frame"],
    category: "構造",
  },
  {
    keywords: ["仕上", "finish", "塗装", "paint", "クロス", "タイル", "tile", "完成", "complete"],
    category: "仕上げ",
  },
  {
    keywords: ["安全", "safety", "保護", "protection", "ヘルメット", "helmet", "警告", "warning", "危険", "danger"],
    category: "安全",
  },
  {
    keywords: ["搬入", "delivery", "搬出", "transport", "資材", "material", "荷受", "荷降", "truck"],
    category: "搬入",
  },
];

const LEGACY_BEFORE_KEYWORDS = ["before", "施工前", "着工前", "解体前", "_bef", "-bef", "before_"];
const LEGACY_AFTER_KEYWORDS = ["after", "施工後", "完成後", "竣工", "_aft", "-aft", "after_"];

function legacyNormalize(str: string): string {
  return str.toLowerCase().replace(/[\s_\-./]/g, "");
}

function legacyDetectBeforeAfter(fileName: string): BeforeAfterLabel {
  const lower = fileName.toLowerCase();
  for (const kw of LEGACY_AFTER_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "after";
  }
  for (const kw of LEGACY_BEFORE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "before";
  }
  return null;
}

function legacyDetectCategory(fileName: string): LegacyPhotoCategory {
  const normalized = legacyNormalize(fileName);
  for (const rule of LEGACY_CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(legacyNormalize(kw))) {
        return rule.category;
      }
    }
  }
  return "その他";
}

/**
 * classifyPhoto — Legacy API. Classify photo by filename and optional metadata.
 * @deprecated Use classifyByFilename instead.
 */
export function classifyPhoto(
  fileName: string,
  metadata?: Omit<PhotoClassifyInput, "fileName">,
): ClassificationResult {
  const input = fileName + (metadata?.capturedAt ?? "");
  const category = legacyDetectCategory(input);
  const beforeAfter = legacyDetectBeforeAfter(fileName);
  return { category, beforeAfter };
}

/**
 * classifyPhotoBatch — Legacy API. Batch classify multiple files.
 * @deprecated Use autoSortPhotos instead.
 */
export function classifyPhotoBatch(
  files: PhotoClassifyInput[],
): Array<PhotoClassifyInput & ClassificationResult> {
  return files.map((f) => ({
    ...f,
    ...classifyPhoto(f.fileName, { capturedAt: f.capturedAt, exifData: f.exifData }),
  }));
}
