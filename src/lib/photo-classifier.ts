/**
 * Photo Classifier — 蔵衛門蒸留
 * ファイル名・メタデータからカテゴリとBefore/Afterを自動推定する。
 */

export type PhotoCategory =
  | "外観"
  | "内装"
  | "設備"
  | "構造"
  | "仕上げ"
  | "安全"
  | "搬入"
  | "その他";

export type BeforeAfterLabel = "before" | "after" | null;

export type ClassificationResult = {
  category: PhotoCategory;
  beforeAfter: BeforeAfterLabel;
};

export type PhotoClassifyInput = {
  fileName: string;
  capturedAt?: string; // ISO datetime
  exifData?: Record<string, unknown>;
};

// ── Category keyword rules ────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ keywords: string[]; category: PhotoCategory }> = [
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
    keywords: ["仕上", "finish", "塗装", "paint", "クロス", "クロス", "タイル", "tile", "完成", "complete"],
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

// ── Before/After keyword rules ────────────────────────────────────────────

const BEFORE_KEYWORDS = ["before", "施工前", "着工前", "解体前", "_bef", "-bef", "before_"];
const AFTER_KEYWORDS = ["after", "施工後", "完成後", "竣工", "_aft", "-aft", "after_"];

// ── Helpers ───────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s_\-./]/g, "");
}

function detectBeforeAfter(fileName: string): BeforeAfterLabel {
  const lower = fileName.toLowerCase();
  for (const kw of AFTER_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "after";
  }
  for (const kw of BEFORE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "before";
  }
  return null;
}

function detectCategory(fileName: string): PhotoCategory {
  const normalized = normalize(fileName);
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(normalize(kw))) {
        return rule.category;
      }
    }
  }
  return "その他";
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * classifyPhoto — ファイル名とメタデータからカテゴリ・Before/Afterを推定する。
 */
export function classifyPhoto(
  fileName: string,
  metadata?: Omit<PhotoClassifyInput, "fileName">,
): ClassificationResult {
  const input = fileName + (metadata?.capturedAt ?? "");
  const category = detectCategory(input);
  const beforeAfter = detectBeforeAfter(fileName);

  return { category, beforeAfter };
}

/**
 * classifyPhotoBatch — 複数ファイルを一括分類する。
 */
export function classifyPhotoBatch(
  files: PhotoClassifyInput[],
): Array<PhotoClassifyInput & ClassificationResult> {
  return files.map((f) => ({
    ...f,
    ...classifyPhoto(f.fileName, { capturedAt: f.capturedAt, exifData: f.exifData }),
  }));
}
