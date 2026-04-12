/**
 * In-memory chat store for project-scoped chat rooms.
 */

import type { ChatMessage, ChatRoom, MessageType } from "../domain/types.js";

// In-memory store keyed by projectId
const rooms: Map<string, ChatRoom> = new Map();
let nextId = 1;

function getOrCreateRoom(projectId: string): ChatRoom {
  if (!rooms.has(projectId)) {
    rooms.set(projectId, {
      projectId,
      messages: [],
      lastActivity: new Date().toISOString(),
    });
  }
  return rooms.get(projectId)!;
}

export function sendMessage(
  projectId: string,
  userId: string,
  userName: string,
  content: string,
  attachments?: string[],
  type?: MessageType,
): ChatMessage {
  const room = getOrCreateRoom(projectId);
  const now = new Date().toISOString();
  const mentions = extractMentions(content);
  const msg: ChatMessage = {
    id: `chat-${nextId++}`,
    projectId,
    userId,
    userName,
    content,
    timestamp: now,
    type: type ?? "text",
    readBy: [],
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    ...(mentions.length > 0 ? { mentions } : {}),
  };
  room.messages.push(msg);
  room.lastActivity = now;
  return msg;
}

/**
 * Mark a message as read by a user.
 * Idempotent — calling twice with the same userId has no effect.
 */
export function markAsRead(
  projectId: string,
  messageId: string,
  userId: string,
): void {
  const room = rooms.get(projectId);
  if (!room) return;
  const msg = room.messages.find((m) => m.id === messageId);
  if (!msg) return;
  if (!msg.readBy) msg.readBy = [];
  if (!msg.readBy.includes(userId)) {
    msg.readBy.push(userId);
  }
}

/**
 * Mark all messages in a project as read by a user (up to optional beforeTimestamp).
 */
export function markAllAsRead(
  projectId: string,
  userId: string,
  beforeTimestamp?: string,
): void {
  const room = rooms.get(projectId);
  if (!room) return;
  for (const msg of room.messages) {
    if (beforeTimestamp && msg.timestamp > beforeTimestamp) continue;
    if (!msg.readBy) msg.readBy = [];
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
    }
  }
}

export function getMessages(
  projectId: string,
  limit?: number,
  before?: string,
): ChatMessage[] {
  const room = rooms.get(projectId);
  if (!room) return [];

  let msgs = [...room.messages];

  if (before) {
    msgs = msgs.filter((m) => m.timestamp < before);
  }

  if (limit !== undefined) {
    msgs = msgs.slice(-limit);
  }

  return msgs;
}

export function getUnreadCount(projectId: string, lastRead: string): number {
  const room = rooms.get(projectId);
  if (!room) return 0;
  return room.messages.filter((m) => m.timestamp > lastRead).length;
}

/**
 * Extract @username mentions from a message text.
 * Matches @<word> where word consists of Unicode letters, digits, and underscores.
 * Requires the @ to be preceded by a non-word character (or start of string)
 * so that email addresses like user@example.com are not treated as mentions.
 * Returns deduplicated list of usernames (without the @ prefix).
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/(?<!\w)@([\p{L}\p{N}_]+)/gu);
  if (!matches) return [];
  const names = matches.map((m) => m.slice(1));
  return [...new Set(names)];
}

/**
 * Return all messages in a project that mention the given userId (matched against mentions array).
 */
export function getMentionsForUser(
  projectId: string,
  userId: string,
): ChatMessage[] {
  const room = rooms.get(projectId);
  if (!room) return [];
  return room.messages.filter((m) => m.mentions?.includes(userId));
}

/** Reset store (for testing) */
export function _resetChatStore(): void {
  rooms.clear();
  nextId = 1;
}

export type { MessageType };
