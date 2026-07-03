/**
 * ChatRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 *
 * NOTE: chat_messages テーブルは userId/userName/readBy/mentions/attachments
 * フィールドが標準スキーマにない可能性があるため、不一致項目は
 * デフォルト値でフォールバックする（Phase C で正式スキーマ追加予定）。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type ChatMessageRecord = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: string;
  readBy: string[];
  attachments?: string[];
  mentions?: string[];
};

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
// DB実スキーマ: id, project_id, organization_id, room_id, sender_id, sender_name, body, message_type, created_at, updated_at
type ChatMessageRow = {
  id: string;
  project_id: string;
  organization_id?: string | null;
  room_id?: string | null;
  sender_id: string;
  sender_name: string;
  body: string;
  message_type: string;
  created_at: string;
};

function rowToMessage(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.sender_id,
    userName: row.sender_name,
    content: row.body,
    timestamp: row.created_at,
    type: row.message_type ?? 'text',
    readBy: [],
  };
}

function messageToRow(m: ChatMessageRecord): ChatMessageRow {
  return {
    id: m.id,
    project_id: m.projectId,
    sender_id: m.userId,
    sender_name: m.userName,
    body: m.content,
    message_type: m.type ?? 'text',
    created_at: m.timestamp,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ChatRepository {
  private store = new Map<string, ChatMessageRecord>();
  private nextId = 1;
  private supabase: SupabaseRepository<ChatMessageRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<ChatMessageRow>('chat_messages') : null;
  }

  // ── async メソッド（Phase C: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<ChatMessageRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToMessage(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listByProjectAsync(projectId: string): Promise<ChatMessageRecord[]> {
    if (this.supabase) {
      // getAll 後にメモリで絞り込み（行数少 MVP 想定）
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToMessage);
    }
    return [...this.store.values()].filter((m) => m.projectId === projectId);
  }

  async listAsync(): Promise<ChatMessageRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToMessage);
    }
    return [...this.store.values()];
  }

  async addAsync(
    projectId: string,
    userId: string,
    userName: string,
    content: string,
    attachments?: string[],
    type?: string,
  ): Promise<ChatMessageRecord> {
    if (this.supabase) {
      const now = new Date().toISOString();
      const tempId = `chat-${this.nextId++}`;
      const msg: ChatMessageRecord = {
        id: tempId,
        projectId,
        userId,
        userName,
        content,
        timestamp: now,
        type: type ?? 'text',
        readBy: [],
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      };
      const row = messageToRow(msg);
      const { id: _id, ...rest } = row;
      void _id;
      const created = await this.supabase.create({ ...rest, id: tempId } as unknown as Omit<ChatMessageRow, 'id'>);
      return rowToMessage(created);
    }
    const now = new Date().toISOString();
    const msg: ChatMessageRecord = {
      id: `chat-${this.nextId++}`,
      projectId,
      userId,
      userName,
      content,
      timestamp: now,
      type: type ?? 'text',
      readBy: [],
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
    this.store.set(msg.id, msg);
    return msg;
  }

  async saveAsync(msg: ChatMessageRecord): Promise<void> {
    if (this.supabase) {
      const row = messageToRow(msg);
      const existing = await this.supabase.getById(msg.id);
      if (existing) {
        await this.supabase.update(msg.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: msg.id } as unknown as Omit<ChatMessageRow, 'id'>);
      }
      return;
    }
    this.store.set(msg.id, { ...msg });
  }

  async deleteAsync(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.store.delete(id);
  }
}
