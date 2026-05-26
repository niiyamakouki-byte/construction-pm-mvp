/**
 * Site Livestream — shared types.
 *
 * Sprint 18-B: 現場ライブストリーム共有
 * 施主が遠隔から現場の進捗を「ライブ配信」「定点カメラ」「録画ハイライト」3チャネルで確認できる。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type LivestreamSessionId = string & { readonly __brand: "LivestreamSessionId" };

export function makeLivestreamSessionId(raw: string): LivestreamSessionId {
  return raw as LivestreamSessionId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type StreamChannelKind =
  | "live_broadcast"
  | "fixed_camera"
  | "recorded_highlight"
  | "milestone_summary";

export type StreamPostStatus =
  | "pending_review"
  | "published"
  | "archived"
  | "flagged";

export type MediaKind = "video" | "photo_burst" | "live_url";

export type PostedByRole = "craftsman" | "supervisor" | "site_manager";

export type NotificationMethod = "email" | "discord" | "line" | "push";

export type DigestFrequency = "immediate" | "daily" | "weekly";

// ── Domain objects ─────────────────────────────────────────────────────────

export type LivestreamPost = {
  id: string;
  projectId: string;
  channelKind: StreamChannelKind;
  postedByName: string;
  postedByRole: PostedByRole;
  title: string;
  description: string;
  mediaKind: MediaKind;
  mediaUrl?: string;
  durationSec?: number;
  capturedAt: string;
  status: StreamPostStatus;
  autoCaptionsJa: string;
  ownerNotificationSent: boolean;
  viewCount: number;
};

export type OwnerNotificationPreference = {
  ownerName: string;
  projectId: string;
  channels: NotificationMethod[];
  digestFrequency: DigestFrequency;
  quietHours: {
    start: string;
    end: string;
  };
};

export type HighlightClip = {
  id: string;
  parentPostId: string;
  startSec: number;
  endSec: number;
  captionJa: string;
  generatedAt: string;
};

export type LivestreamSession = {
  id: LivestreamSessionId;
  projectId: string;
  ownerName: string;
  posts: LivestreamPost[];
  notificationPrefs: OwnerNotificationPreference;
  totalDurationSec: number;
  lastActivityAt: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const CHANNEL_KIND_LABELS: Record<StreamChannelKind, string> = {
  live_broadcast: "ライブ配信",
  fixed_camera: "定点カメラ",
  recorded_highlight: "録画ハイライト",
  milestone_summary: "マイルストーン",
};

export const POST_STATUS_LABELS: Record<StreamPostStatus, string> = {
  pending_review: "審査待ち",
  published: "公開中",
  archived: "アーカイブ",
  flagged: "要確認",
};

export const POSTED_BY_ROLE_LABELS: Record<PostedByRole, string> = {
  craftsman: "職人",
  supervisor: "監督",
  site_manager: "現場管理者",
};

export const NOTIFICATION_METHOD_LABELS: Record<NotificationMethod, string> = {
  email: "メール",
  discord: "Discord",
  line: "LINE",
  push: "プッシュ通知",
};

export const DIGEST_FREQUENCY_LABELS: Record<DigestFrequency, string> = {
  immediate: "即時",
  daily: "日次",
  weekly: "週次",
};
