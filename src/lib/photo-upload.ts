/**
 * Photo upload utilities and construction photo category management.
 * Provides validation, thumbnail generation, and category-based grouping.
 */

export const PhotoCategory = {
  foundation: "foundation",
  framing: "framing",
  electrical: "electrical",
  plumbing: "plumbing",
  hvac: "hvac",
  interior: "interior",
  exterior: "exterior",
  roofing: "roofing",
  finishing: "finishing",
  inspection: "inspection",
  safety: "safety",
  other: "other",
} as const;

export type PhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];

const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  foundation: "基礎工事",
  framing: "躯体工事",
  electrical: "電気工事",
  plumbing: "配管工事",
  hvac: "空調設備",
  interior: "内装工事",
  exterior: "外装工事",
  roofing: "屋根工事",
  finishing: "仕上げ工事",
  inspection: "検査",
  safety: "安全管理",
  other: "その他",
};

export function getCategoryLabel(category: PhotoCategory): string {
  return CATEGORY_LABELS[category] ?? "その他";
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type PhotoValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validate a photo file for upload.
 * Checks MIME type (jpg/png/heic) and file size (<10MB).
 */
export function validatePhoto(file: { type: string; size: number; name: string }): PhotoValidationResult {
  const errors: string[] = [];

  if (!ALLOWED_TYPES.has(file.type)) {
    errors.push(`ファイル形式が非対応です: ${file.type || "不明"}（JPEG, PNG, HEICのみ）`);
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    errors.push(`ファイルサイズが上限を超えています: ${sizeMB}MB（上限10MB）`);
  }

  if (file.size === 0) {
    errors.push("ファイルが空です");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate a thumbnail URL by appending width query parameter.
 * Works with image CDNs that support resize via query params.
 */
export function generateThumbnailUrl(photoUrl: string, width: number = 200): string {
  const url = new URL(photoUrl);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", "80");
  return url.toString();
}

export type PhotoWithCategory = {
  id: string;
  url: string;
  category: PhotoCategory;
  capturedAt: string;
  description: string;
};

export type PhotoCategoryGroup = {
  category: PhotoCategory;
  label: string;
  photos: PhotoWithCategory[];
};

/**
 * Group photos by construction category for organized display.
 * Returns groups sorted by category enum order; photos within each group
 * are sorted by capturedAt ascending.
 */
export function groupPhotosByCategory(photos: PhotoWithCategory[]): PhotoCategoryGroup[] {
  const categoryOrder = Object.values(PhotoCategory);
  const map = new Map<PhotoCategory, PhotoWithCategory[]>();

  for (const photo of photos) {
    const group = map.get(photo.category) ?? [];
    group.push(photo);
    map.set(photo.category, group);
  }

  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => ({
      category: cat,
      label: getCategoryLabel(cat),
      photos: (map.get(cat) ?? []).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    }));
}
