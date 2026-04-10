/**
 * In-memory chat store for project-scoped chat rooms.
 */

import type { ChatMessage, ChatRoom } from "../domain/types.js";

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
): ChatMessage {
  const room = getOrCreateRoom(projectId);
  const now = new Date().toISOString();
  const msg: ChatMessage = {
    id: `chat-${nextId++}`,
    projectId,
    userId,
    userName,
    content,
    timestamp: now,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };
  room.messages.push(msg);
  room.lastActivity = now;
  return msg;
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

/** Reset store (for testing) */
export function _resetChatStore(): void {
  rooms.clear();
  nextId = 1;
}
