/**
 * caption-generator — 自動字幕生成 (テンプレートベース・日本語)
 *
 * Sprint 18-B: 現場ライブストリーム共有
 */

import type { LivestreamPost, LivestreamSession } from "./types.js";
import { CHANNEL_KIND_LABELS, POSTED_BY_ROLE_LABELS } from "./types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatDuration(durationSec?: number): string {
  if (durationSec == null) return "";
  if (durationSec < 60) return `約 ${durationSec} 秒`;
  const minutes = Math.round(durationSec / 60);
  return `約 ${minutes} 分`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * LivestreamPost から自動字幕（日本語）を生成する。
 *
 * 例: "【○○現場】2026/05/09 監督の田中さんが解体作業の進捗を共有しました。約 5 分の動画です。"
 */
export function generateCaption(post: LivestreamPost): string {
  const date = formatDate(post.capturedAt);
  const roleLabel = POSTED_BY_ROLE_LABELS[post.postedByRole];
  const channelLabel = CHANNEL_KIND_LABELS[post.channelKind];

  const parts: string[] = [];

  // ヘッダー
  parts.push(`【${channelLabel}】${date}`);

  // 投稿者情報
  parts.push(`${roleLabel}の${post.postedByName}さんが${post.title}を共有しました。`);

  // 説明
  if (post.description && post.description.trim() !== "") {
    parts.push(post.description.trim());
  }

  // 動画長さ
  const durationStr = formatDuration(post.durationSec);
  if (durationStr) {
    if (post.mediaKind === "video") {
      parts.push(`${durationStr}の動画です。`);
    } else if (post.mediaKind === "photo_burst") {
      parts.push(`${durationStr}の写真バーストです。`);
    }
  } else if (post.mediaKind === "live_url") {
    parts.push("ライブ配信中です。");
  }

  return parts.join(" ");
}

/**
 * セッション内の全 post の autoCaptionsJa を更新したセッションを返す。
 */
export function enrichCaptionsForSession(session: LivestreamSession): LivestreamSession {
  const updatedPosts = session.posts.map((post) => ({
    ...post,
    autoCaptionsJa: generateCaption(post),
  }));

  return {
    ...session,
    posts: updatedPosts,
  };
}
