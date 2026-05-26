/**
 * highlight-extractor — 動画ハイライトクリップ生成 (rule-based)
 *
 * Sprint 18-B: 現場ライブストリーム共有
 */

import type { LivestreamPost, HighlightClip } from "./types.js";

const CLIP_DURATION_SEC = 15;
const MAX_CLIPS = 3;
const HIGHLIGHT_PREFIX = "[ハイライト]";

// ── Helpers ────────────────────────────────────────────────────────────────

let _clipCounter = 0;

function newClipId(): string {
  return `clip-${Date.now()}-${++_clipCounter}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * LivestreamPost からハイライトクリップを生成する。
 *
 * - durationSec >= 60: 0%, 50%, 95% 位置から最大3クリップ
 * - durationSec < 60 または未設定: 単一クリップ (全体)
 */
export function extractHighlights(post: LivestreamPost): HighlightClip[] {
  const now = new Date().toISOString();
  const duration = post.durationSec ?? 0;

  if (duration < 60) {
    // 短い動画 or 長さ不明 → 単一クリップ
    const endSec = duration > 0 ? duration : CLIP_DURATION_SEC;
    return [
      {
        id: newClipId(),
        parentPostId: post.id,
        startSec: 0,
        endSec,
        captionJa: `${HIGHLIGHT_PREFIX} ${post.title}`,
        generatedAt: now,
      },
    ];
  }

  // 長い動画: 0%, 50%, 95% 位置のスナップショット
  const positions = [0, 0.5, 0.95].slice(0, MAX_CLIPS);
  const clips: HighlightClip[] = positions.map((ratio, idx) => {
    const startSec = clamp(Math.floor(ratio * duration), 0, duration - CLIP_DURATION_SEC);
    const endSec = Math.min(startSec + CLIP_DURATION_SEC, duration);

    const labels = ["冒頭", "中盤", "終盤"];
    const label = labels[idx] ?? `部分${idx + 1}`;

    return {
      id: newClipId(),
      parentPostId: post.id,
      startSec,
      endSec,
      captionJa: `${HIGHLIGHT_PREFIX} ${post.title} (${label})`,
      generatedAt: now,
    };
  });

  return clips;
}
