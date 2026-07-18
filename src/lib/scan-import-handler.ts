/**
 * scan-import-handler — /api/scan-import のテスタブルなコア。
 *
 * LaPorta Scan（RoomPlanベースのスキャンパイプライン、bead 4h6dm/7srcc）が
 * 出力した数量・概算見積・写真・間取り画像を GenbaHub 案件として取り込む。
 * Vercel Serverless Function 本体（api/scan-import.ts）はこれを呼び出すだけ。
 *
 * データモデル方針（bead 5t04h）: `sourceLens` はスキャン取り込み元の業種文脈を表す
 * 自由文字列で、内装以外の業種（例: 外構/設備）が将来同じ取り込み経路を使う際に
 * 案件説明へそのまま出るようにするための拡張点。現時点では値を検証・分岐しない。
 */

import { verifyBearerAuth, type SupabaseAuthVerifier } from "./auth-helper.js";
import { consumeRateLimit, type RateLimitStore } from "./rate-limiter.js";

export const SCAN_IMPORT_ENDPOINT = "/api/scan-import";
export const SCAN_IMPORT_RATE_LIMIT_PER_MIN = 5;
/** 写真1枚あたりの上限（construction-photos バケットの file_size_limit と一致） */
export const MAX_PHOTO_BASE64_BYTES = 10 * 1024 * 1024;
/** ドキュメント1件あたりの上限（project-documents バケットの file_size_limit と一致） */
export const MAX_DOCUMENT_BASE64_BYTES = 25 * 1024 * 1024;

const PHOTO_BUCKET = "construction-photos";
const DOCUMENT_BUCKET = "project-documents";
const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];
const DOCUMENT_TYPES = [
  "drawing",
  "contract",
  "permit",
  "daily_report",
  "photo",
  "invoice",
  "other",
] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type ScanQuantities = {
  floorAreaM2?: number;
  wallAreaNetM2?: number;
  ceilingAreaM2?: number;
  ceilingHeightM?: number;
  perimeterM?: number;
  skirtingLengthM?: number;
  crownLengthM?: number;
};

export type ScanEstimateItem = {
  code?: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
};

export type ScanEstimate = {
  items: ScanEstimateItem[];
  taxExcludedTotal: number;
  taxIncludedTotal: number;
};

export type ScanImportFile = {
  mediaType: string;
  data: string; // base64
  fileName: string;
};

export type ScanImportPhoto = ScanImportFile & {
  category?: string;
  caption?: string;
};

export type ScanImportRequestBody = {
  projectName?: string;
  client?: string;
  address?: string;
  /** スキャン取り込み元の業種文脈。現状は案件説明への埋め込み用途のみ(検証・分岐なし)。 */
  sourceLens?: string;
  quantities?: ScanQuantities;
  estimate?: ScanEstimate;
  floorPlan?: ScanImportFile;
  photos?: ScanImportPhoto[];
};

export type ScanImportRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ScanImportResponse = {
  status: (code: number) => ScanImportResponse;
  json: (body: unknown) => ScanImportResponse;
  setHeader?: (name: string, value: string) => void;
  end?: () => void;
};

export type UploadResult = {
  storagePath: string;
  url: string;
};

/** テスト/本番の両方でDIしやすい最小限のDBインターフェース。*/
export type ScanImportDb = {
  insertProject: (row: {
    id: string;
    name: string;
    description: string;
    status: "planning";
    startDate: string;
    address: string | null;
  }) => Promise<{ error: { message: string } | null }>;
  uploadFile: (args: {
    bucket: string;
    path: string;
    data: Buffer;
    contentType: string;
  }) => Promise<{ url: string; error: { message: string } | null }>;
  insertPhoto: (row: {
    id: string;
    projectId: string;
    storageBucket: string;
    storagePath: string;
    url: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    category: string | null;
    caption: string | null;
    takenAt: string;
  }) => Promise<{ error: { message: string } | null }>;
  insertDocument: (row: {
    id: string;
    projectId: string;
    name: string;
    type: DocumentType;
    url: string;
    uploadedBy: string;
    version: string;
  }) => Promise<{ error: { message: string } | null }>;
};

export type ScanImportDeps = {
  auth: SupabaseAuthVerifier;
  rateLimitStore: RateLimitStore;
  db: ScanImportDb;
  idGenerator?: () => string;
  now?: () => Date;
};

function readBody(req: ScanImportRequest): ScanImportRequestBody {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as ScanImportRequestBody;
    } catch {
      return {};
    }
  }
  return req.body as ScanImportRequestBody;
}

function extensionFor(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/heic") return "heic";
  if (mediaType === "image/heif") return "heif";
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "application/pdf") return "pdf";
  return "bin";
}

function formatQuantities(q: ScanQuantities | undefined): string {
  if (!q) return "";
  const lines: string[] = [];
  if (q.floorAreaM2 != null) lines.push(`床面積: ${q.floorAreaM2.toFixed(2)}m2`);
  if (q.wallAreaNetM2 != null) lines.push(`壁面積(開口控除): ${q.wallAreaNetM2.toFixed(2)}m2`);
  if (q.ceilingAreaM2 != null) lines.push(`天井面積: ${q.ceilingAreaM2.toFixed(2)}m2`);
  if (q.ceilingHeightM != null) lines.push(`天井高: ${q.ceilingHeightM.toFixed(2)}m`);
  if (q.perimeterM != null) lines.push(`周長: ${q.perimeterM.toFixed(2)}m`);
  if (q.skirtingLengthM != null) lines.push(`巾木長: ${q.skirtingLengthM.toFixed(2)}m`);
  if (q.crownLengthM != null) lines.push(`廻縁長: ${q.crownLengthM.toFixed(2)}m`);
  return lines.length ? `【スキャン寸法】\n${lines.join("\n")}` : "";
}

function formatEstimate(e: ScanEstimate | undefined): string {
  if (!e || !e.items?.length) return "";
  const lines = e.items.map(
    (it) => `- ${it.name}${it.unit ? `(${it.quantity}${it.unit})` : ""}: ¥${it.amount.toLocaleString("ja-JP")}`,
  );
  lines.push(`税抜合計: ¥${e.taxExcludedTotal.toLocaleString("ja-JP")}`);
  lines.push(`税込合計: ¥${e.taxIncludedTotal.toLocaleString("ja-JP")}`);
  return `【概算見積(スキャン自動生成・要確認)】\n${lines.join("\n")}`;
}

function defaultIdGenerator(): string {
  return globalThis.crypto.randomUUID();
}

export async function handleScanImport(
  req: ScanImportRequest,
  res: ScanImportResponse,
  deps: ScanImportDeps,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const authResult = await verifyBearerAuth(deps.auth, req.headers);
  if (!authResult.ok) {
    res.status(401).json({ error: authResult.error });
    return;
  }

  const body = readBody(req);
  const { projectName, client, address, sourceLens, quantities, estimate, floorPlan, photos } = body;

  if (!projectName || !projectName.trim()) {
    res.status(400).json({ error: "projectName は必須です" });
    return;
  }

  if (floorPlan && floorPlan.data.length > MAX_DOCUMENT_BASE64_BYTES) {
    res.status(413).json({ error: "間取り画像が大きすぎます（上限25MB）" });
    return;
  }
  if (floorPlan && !DOCUMENT_MIME_TYPES.includes(floorPlan.mediaType)) {
    res.status(400).json({ error: `間取り画像の形式が非対応です: ${floorPlan.mediaType}` });
    return;
  }
  for (const photo of photos ?? []) {
    if (photo.data.length > MAX_PHOTO_BASE64_BYTES) {
      res.status(413).json({ error: `写真が大きすぎます（上限10MB）: ${photo.fileName}` });
      return;
    }
    if (!PHOTO_MIME_TYPES.includes(photo.mediaType)) {
      res.status(400).json({ error: `写真の形式が非対応です: ${photo.mediaType}` });
      return;
    }
  }

  const decision = await consumeRateLimit(deps.rateLimitStore, {
    userId: authResult.user.id,
    endpoint: SCAN_IMPORT_ENDPOINT,
    limit: SCAN_IMPORT_RATE_LIMIT_PER_MIN,
    windowSeconds: 60,
    now: deps.now,
  });
  if (!decision.allowed) {
    res.setHeader?.("Retry-After", String(decision.retryAfterSeconds));
    res.status(429).json({
      error: `リクエストが多すぎます。${decision.retryAfterSeconds}秒後に再試行してください。`,
    });
    return;
  }

  const idGenerator = deps.idGenerator ?? defaultIdGenerator;
  const now = deps.now ?? (() => new Date());
  const nowIso = now().toISOString();
  const projectId = idGenerator();

  const descriptionParts: string[] = [];
  if (client) descriptionParts.push(`施主: ${client}`);
  if (sourceLens) descriptionParts.push(`取込元レンズ: ${sourceLens}`);
  const quantitiesText = formatQuantities(quantities);
  if (quantitiesText) descriptionParts.push(quantitiesText);
  const estimateText = formatEstimate(estimate);
  if (estimateText) descriptionParts.push(estimateText);
  descriptionParts.push("(LaPorta Scan 取り込み)");

  const projectResult = await deps.db.insertProject({
    id: projectId,
    name: projectName.trim(),
    description: descriptionParts.join("\n\n"),
    status: "planning",
    startDate: nowIso.slice(0, 10),
    address: address ?? null,
  });
  if (projectResult.error) {
    res.status(502).json({ error: projectResult.error.message });
    return;
  }

  let documentCount = 0;
  if (floorPlan) {
    const docId = idGenerator();
    const path = `${projectId}/${docId}.${extensionFor(floorPlan.mediaType)}`;
    const upload = await deps.db.uploadFile({
      bucket: DOCUMENT_BUCKET,
      path,
      data: Buffer.from(floorPlan.data, "base64"),
      contentType: floorPlan.mediaType,
    });
    if (upload.error) {
      res.status(502).json({ error: upload.error.message });
      return;
    }
    const docResult = await deps.db.insertDocument({
      id: docId,
      projectId,
      name: floorPlan.fileName,
      type: "drawing",
      url: upload.url,
      uploadedBy: authResult.user.id,
      version: "1",
    });
    if (docResult.error) {
      res.status(502).json({ error: docResult.error.message });
      return;
    }
    documentCount += 1;
  }

  let photoCount = 0;
  for (const photo of photos ?? []) {
    const photoId = idGenerator();
    const path = `${projectId}/${photoId}.${extensionFor(photo.mediaType)}`;
    const upload = await deps.db.uploadFile({
      bucket: PHOTO_BUCKET,
      path,
      data: Buffer.from(photo.data, "base64"),
      contentType: photo.mediaType,
    });
    if (upload.error) {
      res.status(502).json({ error: upload.error.message });
      return;
    }
    const photoResult = await deps.db.insertPhoto({
      id: photoId,
      projectId,
      storageBucket: PHOTO_BUCKET,
      storagePath: path,
      url: upload.url,
      fileName: photo.fileName,
      contentType: photo.mediaType,
      fileSize: Buffer.byteLength(photo.data, "base64"),
      category: photo.category ?? "scan",
      caption: photo.caption ?? null,
      takenAt: nowIso,
    });
    if (photoResult.error) {
      res.status(502).json({ error: photoResult.error.message });
      return;
    }
    photoCount += 1;
  }

  res.status(200).json({ projectId, documentCount, photoCount });
}
