/**
 * post-validator — LivestreamPost バリデーション
 *
 * Sprint 18-B: 現場ライブストリーム共有
 */

import type { LivestreamPost } from "./types.js";

// ── NG ワード辞書 (簡易) ───────────────────────────────────────────────────

const NG_WORDS = [
  "死ね",
  "殺す",
  "バカ",
  "アホ",
  "クソ",
  "ふざけるな",
  "最悪",
  "うんこ",
] as const;

// ── Public API ─────────────────────────────────────────────────────────────

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};

/**
 * LivestreamPost のバリデーションを実行する。
 * 問題がある場合は issues に説明を追加し、valid=false を返す。
 * NGワード検出時は flagged を推奨する (呼び出し元がステータスを更新)。
 */
export function validatePost(post: LivestreamPost): ValidationResult {
  const issues: string[] = [];

  // タイトル必須
  if (!post.title || post.title.trim() === "") {
    issues.push("タイトルは必須です");
  }

  // durationSec: live_broadcast 以外は必須
  if (post.channelKind !== "live_broadcast") {
    if (post.durationSec == null || post.durationSec <= 0) {
      issues.push("ライブ配信以外は動画の長さ（秒数）が必要です");
    }
  }

  // mediaUrl: live_url の場合 https:// 必須
  if (post.mediaKind === "live_url") {
    if (!post.mediaUrl || !post.mediaUrl.startsWith("https://")) {
      issues.push("ライブURLは https:// で始まる必要があります");
    }
  }

  // NGワード検出
  const textToCheck = `${post.title} ${post.description}`;
  for (const ng of NG_WORDS) {
    if (textToCheck.includes(ng)) {
      issues.push(`不適切な表現が含まれています: "${ng}"`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
