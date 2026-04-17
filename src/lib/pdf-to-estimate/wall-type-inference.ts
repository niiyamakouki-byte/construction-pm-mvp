/**
 * LGS壁タイプ推定ロジック
 *
 * 光輝さん現場知見:
 *   LGS45/65 がメイン用途（priority 10）
 *   不明時は LGS65 が最頻出のため fallback
 *
 * 3段判定:
 *   1. テキスト直接抽出（最強） — "LGS65" "C-75" "75型" 等
 *   2. 壁厚 mm から typicalWallThicknessMm 範囲マッチ
 *   3. 不明なら LGS65 を既定
 */

import { WALL_TYPE_RULES } from "./types.js";
import type { WallType } from "./types.js";

// ─── テキスト抽出パターン ────────────────────────────────────────

/**
 * 図面テキストから LGS タイプを直接読み取るパターン。
 * 優先度順に並べてある（最初にマッチしたものを採用）。
 */
const TEXT_PATTERNS: Array<{ pattern: RegExp; type: WallType }> = [
  // LGS100 / C-100
  { pattern: /\bLGS[\s-]?100\b/i, type: "LGS100" },
  { pattern: /\bC[\s-]100\b/i, type: "LGS100" },
  { pattern: /(?<![0-9])100[型形]/, type: "LGS100" },
  // LGS90 / C-90
  { pattern: /\bLGS[\s-]?90\b/i, type: "LGS90" },
  { pattern: /\bC[\s-]90\b/i, type: "LGS90" },
  { pattern: /(?<![0-9])90[型形]/, type: "LGS90" },
  // LGS75 / C-75
  { pattern: /\bLGS[\s-]?75\b/i, type: "LGS75" },
  { pattern: /\bC[\s-]75\b/i, type: "LGS75" },
  { pattern: /(?<![0-9])75[型形]/, type: "LGS75" },
  // LGS65 / C-65
  { pattern: /\bLGS[\s-]?65\b/i, type: "LGS65" },
  { pattern: /\bC[\s-]65\b/i, type: "LGS65" },
  { pattern: /(?<![0-9])65[型形]/, type: "LGS65" },
  // LGS50 / C-50
  { pattern: /\bLGS[\s-]?50\b/i, type: "LGS50" },
  { pattern: /\bC[\s-]50\b/i, type: "LGS50" },
  { pattern: /(?<![0-9])50[型形]/, type: "LGS50" },
  // LGS45 / C-45
  { pattern: /\bLGS[\s-]?45\b/i, type: "LGS45" },
  { pattern: /\bC[\s-]45\b/i, type: "LGS45" },
  { pattern: /(?<![0-9])45[型形]/, type: "LGS45" },
  // LGS20ランナー
  { pattern: /\bLGS[\s-]?20\b/i, type: "LGS20_runner" },
  { pattern: /\bC[\s-]20\b/i, type: "LGS20_runner" },
  { pattern: /(?<![0-9])20[型形]/, type: "LGS20_runner" },
  { pattern: /ランナー20|20ランナー/, type: "LGS20_runner" },
  // 木下地
  { pattern: /木下地|木製下地|間柱/, type: "木下地" },
];

// ─── 壁厚→タイプマッピング ──────────────────────────────────────

/**
 * 壁厚 mm から候補タイプを priority 順で返す。
 * 複数の range に重なる場合は priority 高いものを優先。
 */
function inferFromThickness(thicknessMm: number): WallType | null {
  const candidates: Array<{ type: WallType; priority: number }> = [];

  for (const rule of Object.values(WALL_TYPE_RULES)) {
    const [lo, hi] = rule.typicalWallThicknessMm;
    if (thicknessMm >= lo && thicknessMm <= hi) {
      candidates.push({ type: rule.type, priority: rule.priority });
    }
  }

  if (candidates.length === 0) {
    // 範囲外: 最も近い候補を探す
    let minDist = Infinity;
    let closest: WallType | null = null;
    for (const rule of Object.values(WALL_TYPE_RULES)) {
      const [lo, hi] = rule.typicalWallThicknessMm;
      const mid = (lo + hi) / 2;
      const dist = Math.abs(thicknessMm - mid);
      if (dist < minDist || (dist === minDist && rule.priority > (WALL_TYPE_RULES[closest!]?.priority ?? 0))) {
        minDist = dist;
        closest = rule.type;
      }
    }
    return closest;
  }

  // priority 最大を採用（同点なら LGS65 優先: メイン用途）
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.type === "LGS65" ? -1 : b.type === "LGS65" ? 1 : 0;
  });
  return candidates[0].type;
}

// ─── Public API ──────────────────────────────────────────────────

export interface WallTypeInferenceResult {
  type: WallType;
  /** 0.0〜1.0 */
  confidence: number;
  /** 判定根拠（ログ・UI向け） */
  reason: string;
}

/**
 * 壁タイプ推定。
 *
 * @param options.nearbyTexts - 図面上の近傍テキスト群
 * @param options.measuredThicknessMm - 実測または推定の壁厚(mm)
 * @param options.defaultType - 完全不明時の fallback（省略時 LGS65）
 */
export function inferWallType(options: {
  nearbyTexts?: string[];
  measuredThicknessMm?: number;
  defaultType?: WallType;
}): WallTypeInferenceResult {
  const { nearbyTexts, measuredThicknessMm, defaultType = "LGS65" } = options;

  // 1. テキスト直接抽出（confidence 0.95）
  if (nearbyTexts && nearbyTexts.length > 0) {
    for (const text of nearbyTexts) {
      for (const { pattern, type } of TEXT_PATTERNS) {
        if (pattern.test(text)) {
          return {
            type,
            confidence: 0.95,
            reason: `テキスト「${text}」がパターン ${pattern.toString()} にマッチ`,
          };
        }
      }
    }
  }

  // 2. 壁厚から推定（confidence 0.65）
  if (measuredThicknessMm != null && measuredThicknessMm > 0) {
    const inferred = inferFromThickness(measuredThicknessMm);
    if (inferred) {
      const rule = WALL_TYPE_RULES[inferred];
      const [lo, hi] = rule.typicalWallThicknessMm;
      const inRange = measuredThicknessMm >= lo && measuredThicknessMm <= hi;
      return {
        type: inferred,
        confidence: inRange ? 0.65 : 0.40,
        reason: `壁厚 ${measuredThicknessMm}mm → 典型範囲 ${lo}〜${hi}mm の ${inferred}${inRange ? "" : "（範囲外・最近傍）"}`,
      };
    }
  }

  // 3. Fallback（LGS65 最頻出）
  return {
    type: defaultType,
    confidence: 0.30,
    reason: `推定根拠なし → fallback (${defaultType})`,
  };
}
