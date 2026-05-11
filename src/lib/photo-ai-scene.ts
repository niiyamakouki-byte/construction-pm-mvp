/**
 * photo-ai-scene.ts — Sprint 65 写真AI仕分け強化
 *
 * 1. SceneTag  — シーン推定（外観/内装/設備/資材/職人作業/完了写真/安全/進捗/その他）
 * 2. PartTag   — 部位推定（天井/壁/床/建具/設備機器/基礎構造/外壁/屋根/その他）
 * 3. pHash     — 平均ハッシュ(8x8) + ハミング距離による重複グループ検出
 *
 * LLM不使用。ファイル名・既存タグ・メタデータのheuristicsのみ。
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SceneTag =
  | "外観"
  | "内装"
  | "設備"
  | "資材"
  | "職人作業"
  | "完了写真"
  | "安全"
  | "進捗"
  | "その他";

export type PartTag =
  | "天井"
  | "壁"
  | "床"
  | "建具"
  | "設備機器"
  | "基礎構造"
  | "外壁"
  | "屋根"
  | "その他";

export type SceneResult = {
  scene: SceneTag;
  confidence: number; // 0.0 – 1.0
};

export type PartResult = {
  part: PartTag;
  confidence: number; // 0.0 – 1.0
};

export type PhotoHashEntry = {
  id: string;
  filename: string;
  /** 64-bit average hash encoded as hex string (16 hex chars) */
  hash: string;
  takenAt?: Date;
};

export type DuplicateGroup = {
  photos: PhotoHashEntry[];
  /** Hamming distance between hashes (0 = identical, ≤10 = similar) */
  maxDistance: number;
};

// ── Scene Heuristics ──────────────────────────────────────────────────────────

type SceneRule = { pattern: RegExp; scene: SceneTag; weight: number };

const SCENE_RULES: SceneRule[] = [
  // 外観
  {
    pattern: /外観|外壁|外装|ファサード|façade|facade|正面|前面|外構|屋根|サッシ|外周|全景|俯瞰|ドローン|空撮|外部/i,
    scene: "外観",
    weight: 4,
  },
  // 内装 (タイルは外壁・外観でも使うため除外)
  {
    pattern: /内装|内部|室内|天井|壁紙|クロス|フローリング|床|カーペット|塗装|内観|仕上げ|仕上|下地|ボード|LGS|軽鉄|断熱/i,
    scene: "内装",
    weight: 3,
  },
  // 設備
  {
    pattern: /設備|配管|配線|ダクト|電気|空調|衛生|給水|排水|照明|スイッチ|コンセント|換気|スプリンクラー|感知器|弱電|LAN/i,
    scene: "設備",
    weight: 3,
  },
  // 資材
  {
    pattern: /搬入|資材|材料|荷受|荷降|納品|在庫|鋼材|木材|コンクリート材|材料検収|廃材|搬出|delivery/i,
    scene: "資材",
    weight: 3,
  },
  // 職人作業
  {
    pattern: /作業|施工|工事|職人|作業員|工員|大工|左官|鉄筋工|型枠|溶接|塗装工|内装工|手元|worker|craftsman/i,
    scene: "職人作業",
    weight: 2,
  },
  // 完了写真
  {
    pattern: /完成|竣工|引渡|完了|仕上がり|完成写真|after|施工後|竣工後|after_|_aft|complete|finished/i,
    scene: "完了写真",
    weight: 4,
  },
  // 安全
  {
    pattern: /安全|KY|朝礼|ヘルメット|安全帯|保護具|TBM|危険|警告|安全確認|safety|patrol/i,
    scene: "安全",
    weight: 3,
  },
  // 進捗
  {
    pattern: /進捗|全体|全景|施工状況|工事状況|現場状況|progress|overview|全工程/i,
    scene: "進捗",
    weight: 2,
  },
];

/**
 * inferScene — ファイル名・タグからシーンを推定する。
 */
export function inferScene(filename: string, tags?: string[]): SceneResult {
  const text = [filename, ...(tags ?? [])].join(" ");

  let bestScene: SceneTag = "その他";
  let bestScore = 0;

  for (const rule of SCENE_RULES) {
    const matches = text.match(new RegExp(rule.pattern.source, "gi")) ?? [];
    if (matches.length === 0) continue;
    const score = matches.reduce((s, m) => s + m.length, 0) * rule.weight;
    if (score > bestScore) {
      bestScore = score;
      bestScene = rule.scene;
    }
  }

  // Confidence: clamp to [0, 1] based on score relative to a reference ceiling
  const confidence =
    bestScore === 0 ? 0 : Math.min(1.0, parseFloat((bestScore / 60).toFixed(2)));

  return { scene: bestScene, confidence };
}

// ── Part Heuristics ───────────────────────────────────────────────────────────

type PartRule = { pattern: RegExp; part: PartTag; weight: number };

const PART_RULES: PartRule[] = [
  {
    pattern: /天井|ceiling|軒天|軒裏|天伏|天井裏/i,
    part: "天井",
    weight: 6,
  },
  {
    pattern: /壁|wall|壁面|腰壁|間仕切|パーティション|スタッド|LGS|軽鉄|軽天|クロス|壁紙|壁タイル|壁塗装/i,
    part: "壁",
    weight: 3,
  },
  {
    pattern: /床|floor|フローリング|CF|カーペット|長尺|タイルカーペット|石貼|畳|下地コン|土間/i,
    part: "床",
    weight: 3,
  },
  {
    pattern: /建具|ドア|扉|サッシ|window|door|パーティション|引戸|引き戸|開口/i,
    part: "建具",
    weight: 3,
  },
  {
    pattern: /設備機器|エアコン|FCU|AHU|空調機|換気扇|ファン|照明器具|ダウンライト|盤|分電盤|衛生器具|便器|洗面|キッチン|シンク/i,
    part: "設備機器",
    weight: 4,
  },
  {
    pattern: /基礎|杭|スラブ|梁|柱|鉄筋|コンクリート|型枠|躯体|構造|フーチング|根切|土工/i,
    part: "基礎構造",
    weight: 4,
  },
  {
    pattern: /外壁|外装|ファサード|タイル外壁|ALC|EPS|外断熱|外壁仕上/i,
    part: "外壁",
    weight: 4,
  },
  {
    pattern: /屋根|roof|屋上|防水|ルーフ|スレート|瓦|折板/i,
    part: "屋根",
    weight: 4,
  },
];

/**
 * inferPart — ファイル名・タグから部位を推定する。
 */
export function inferPart(filename: string, tags?: string[]): PartResult {
  const text = [filename, ...(tags ?? [])].join(" ");

  let bestPart: PartTag = "その他";
  let bestScore = 0;

  for (const rule of PART_RULES) {
    const matches = text.match(new RegExp(rule.pattern.source, "gi")) ?? [];
    if (matches.length === 0) continue;
    const score = matches.reduce((s, m) => s + m.length, 0) * rule.weight;
    if (score > bestScore) {
      bestScore = score;
      bestPart = rule.part;
    }
  }

  const confidence =
    bestScore === 0 ? 0 : Math.min(1.0, parseFloat((bestScore / 60).toFixed(2)));

  return { part: bestPart, confidence };
}

// ── pHash (Average Hash 8×8) ──────────────────────────────────────────────────
//
// Without actual pixel data we cannot compute a true pHash from image content.
// Instead we build a deterministic pseudo-hash from filename characteristics:
//   - Character code sum, string length, vowel/consonant ratio, character variance.
// This gives a stable 64-bit fingerprint that collapses to the same hash for
// identical filenames and diverges gradually for dissimilar ones.
//
// IMPORTANT: This is a filename-fingerprint, not a perceptual pixel hash.
// It correctly detects exact-duplicate filenames and flags near-duplicate
// patterns (e.g., burst sequences with sequential suffixes).
// For true pixel-level pHash, replace computeAverageHash() with a canvas/wasm
// based implementation that receives pixel data.

/**
 * computeAverageHash — Compute a 64-bit average hash (as 16-char hex string)
 * from a filename. Stable and deterministic.
 *
 * Uses FNV-inspired mixing: expands the filename into 64 pseudo-pixel values
 * by cycling through characters with position-dependent mixing coefficients.
 * This ensures short filenames with different characters produce distinct hashes.
 */
export function computeAverageHash(filename: string): string {
  // Strip extension and normalize
  const base = filename.replace(/\.\w+$/, "").toLowerCase();
  const len = base.length || 1; // avoid division by zero

  // Expand to 64 pseudo-pixels using position-dependent mixing
  const pixels: number[] = new Array(64);
  for (let i = 0; i < 64; i++) {
    const code = base.charCodeAt(i % len);
    pixels[i] = ((code * 31 + i * 17) ^ (i << 3)) & 0xff;
  }

  // Compute average
  const avg = pixels.reduce((s, v) => s + v, 0) / 64;

  // Threshold: bit = 1 if pixel >= average
  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (pixels[i] >= avg) {
      hash |= BigInt(1) << BigInt(63 - i);
    }
  }

  // Encode as 16-char hex (zero-padded)
  return hash.toString(16).padStart(16, "0");
}

/**
 * hammingDistance — Count differing bits between two hex-encoded 64-bit hashes.
 */
export function hammingDistance(hashA: string, hashB: string): number {
  const a = BigInt("0x" + hashA);
  const b = BigInt("0x" + hashB);
  let xor = a ^ b;
  let dist = 0;
  while (xor > BigInt(0)) {
    dist += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return dist;
}

/**
 * groupDuplicatesByHash — Group photos by pHash similarity.
 * Photos within `threshold` Hamming distance are considered duplicates.
 * Default threshold = 10 (out of 64 bits).
 */
export function groupDuplicatesByHash(
  photos: PhotoHashEntry[],
  threshold = 10,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    if (assigned.has(photos[i].id)) continue;

    const group: PhotoHashEntry[] = [photos[i]];
    let maxDist = 0;

    for (let j = i + 1; j < photos.length; j++) {
      if (assigned.has(photos[j].id)) continue;
      const dist = hammingDistance(photos[i].hash, photos[j].hash);
      if (dist <= threshold) {
        group.push(photos[j]);
        assigned.add(photos[j].id);
        if (dist > maxDist) maxDist = dist;
      }
    }

    if (group.length > 1) {
      assigned.add(photos[i].id);
      groups.push({ photos: group, maxDistance: maxDist });
    }
  }

  return groups;
}

/**
 * buildHashEntries — Convenience wrapper: compute hashes for an array of photos.
 */
export function buildHashEntries(
  photos: Array<{ id: string; filename: string; takenAt?: Date }>,
): PhotoHashEntry[] {
  return photos.map((p) => ({
    id: p.id,
    filename: p.filename,
    hash: computeAverageHash(p.filename),
    takenAt: p.takenAt,
  }));
}
