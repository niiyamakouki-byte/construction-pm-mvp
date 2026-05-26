/**
 * livestream-facade — 現場ライブストリームワークフローの公開API
 *
 * Sprint 18-B: 現場ライブストリーム共有
 */

import type {
  LivestreamSession,
  LivestreamSessionId,
  LivestreamPost,
  OwnerNotificationPreference,
} from "./types.js";
import { makeLivestreamSessionId } from "./types.js";
import { livestreamStore } from "./livestream-store.js";
import { validatePost } from "./post-validator.js";
import { generateCaption } from "./caption-generator.js";
import { extractHighlights } from "./highlight-extractor.js";
import { dispatchNotifications } from "./owner-notifier.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _sessionCounter = 0;

function newSessionId(): LivestreamSessionId {
  return makeLivestreamSessionId(`ls-${Date.now()}-${++_sessionCounter}`);
}

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * 新しいライブストリームセッションを作成して保存・返却する。
 */
export function createSession(
  projectId: string,
  ownerName: string,
  prefs: OwnerNotificationPreference,
  now = new Date(),
): LivestreamSession {
  const session: LivestreamSession = {
    id: newSessionId(),
    projectId,
    ownerName,
    posts: [],
    notificationPrefs: prefs,
    totalDurationSec: 0,
    lastActivityAt: now.toISOString(),
  };

  livestreamStore.add(session);
  return session;
}

// ── Add post ───────────────────────────────────────────────────────────────

/**
 * セッションに新規投稿を追加する。
 * 内部で validation → caption → highlight → notify を連鎖実行する。
 *
 * バリデーション失敗時: post.status を "flagged" に変更して保存する。
 */
export function addPost(
  sessionId: LivestreamSessionId,
  post: LivestreamPost,
  now = new Date(),
): LivestreamSession | null {
  const session = livestreamStore.get(sessionId);
  if (!session) return null;

  // 1. Validation
  const validation = validatePost(post);
  const resolvedPost: LivestreamPost = validation.valid
    ? post
    : { ...post, status: "flagged" };

  // 2. Caption generation
  const captionedPost: LivestreamPost = {
    ...resolvedPost,
    autoCaptionsJa: generateCaption(resolvedPost),
  };

  // 3. Highlight extraction (side data — not stored in session directly)
  extractHighlights(captionedPost);

  // 4. Update session
  const newPosts = [...session.posts, captionedPost];
  const totalDurationSec = newPosts.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);
  const updated = livestreamStore.update(sessionId, {
    posts: newPosts,
    totalDurationSec,
    lastActivityAt: now.toISOString(),
  });

  if (!updated) return null;

  // 5. Notifications
  const notifyPost = { ...captionedPost, ownerNotificationSent: false };
  const result = dispatchNotifications(updated, notifyPost, now);

  // Mark ownerNotificationSent if dispatched
  if (result.dispatched.length > 0) {
    const finalPosts = updated.posts.map((p) =>
      p.id === captionedPost.id ? { ...p, ownerNotificationSent: true } : p,
    );
    return livestreamStore.update(sessionId, { posts: finalPosts });
  }

  return updated;
}

// ── Status transitions ─────────────────────────────────────────────────────

/**
 * 投稿を published に変更する。
 */
export function markPostPublished(
  sessionId: LivestreamSessionId,
  postId: string,
): LivestreamSession | null {
  const session = livestreamStore.get(sessionId);
  if (!session) return null;

  const updatedPosts = session.posts.map((p) =>
    p.id === postId ? { ...p, status: "published" as const } : p,
  );
  return livestreamStore.update(sessionId, { posts: updatedPosts });
}

/**
 * 投稿を archived に変更する。
 */
export function archivePost(
  sessionId: LivestreamSessionId,
  postId: string,
): LivestreamSession | null {
  const session = livestreamStore.get(sessionId);
  if (!session) return null;

  const updatedPosts = session.posts.map((p) =>
    p.id === postId ? { ...p, status: "archived" as const } : p,
  );
  return livestreamStore.update(sessionId, { posts: updatedPosts });
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * プロジェクトIDでセッションを取得する。
 * 同一プロジェクトに複数セッションがある場合、最新を返す。
 */
export function getSessionByProject(projectId: string): LivestreamSession | null {
  const all = livestreamStore.getAll();
  const forProject = all.filter((s) => s.projectId === projectId);
  return forProject[0] ?? null;
}

/** 全セッション一覧を返す */
export function listAllSessions(limit = 100): LivestreamSession[] {
  return livestreamStore.getAll(limit);
}

/** IDでセッションを取得 */
export function getSession(id: LivestreamSessionId): LivestreamSession | null {
  return livestreamStore.get(id);
}

/** セッションを削除する */
export function removeSession(id: LivestreamSessionId): void {
  livestreamStore.remove(id);
}
