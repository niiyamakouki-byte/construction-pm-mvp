/**
 * ChatRepository — Phase B
 * 同期メソッドはインメモリ（既存互換）。
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
type ChatMessageRow = {
  id: string;
  project_id: string;
  sender: string;
  content: string;
  created_at: string;
};

function rowToMessage(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.sender,
    userName: row.sender,
    content: row.content,
    timestamp: row.created_at,
    type: 'text',
    readBy: [],
  };
}

function messageToRow(m: ChatMessageRecord): ChatMessageRow {
  return {
    id: m.id,
    project_id: m.projectId,
    sender: m.userId,
    content: m.content,
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

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  get(id: string): ChatMessageRecord | null {
    return this.store.get(id) ?? null;
  }

  listByProject(projectId: string): ChatMessageRecord[] {
    return [...this.store.values()].filter((m) => m.projectId === projectId);
  }

  list(): ChatMessageRecord[] {
    return [...this.store.values()];
  }

  add(
    projectId: string,
    userId: string,
    userName: string,
    content: string,
    attachments?: string[],
    type?: string,
  ): ChatMessageRecord {
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

  save(msg: ChatMessageRecord): void {
    this.store.set(msg.id, { ...msg });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async メソッド（Phase B: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<ChatMessageRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToMessage(row) : null;
    }
    return this.get(id);
  }

  async listByProjectAsync(projectId: string): Promise<ChatMessageRecord[]> {
    if (this.supabase) {
      // getAll 後にメモリで絞り込み（行数少 MVP 想定）
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToMessage);
    }
    return this.listByProject(projectId);
  }

  async listAsync(): Promise<ChatMessageRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToMessage);
    }
    return this.list();
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
    return this.add(projectId, userId, userName, content, attachments, type);
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
    this.save(msg);
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
    return this.delete(id);
  }
}
