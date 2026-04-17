/**
 * ChatRepository — Phase A
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは現時点でインメモリにルーティング（Phase A）。
 * TODO: Phase B — VITE_USE_SUPABASE=true のとき Supabase へ切替
 */

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

export class ChatRepository {
  private store = new Map<string, ChatMessageRecord>();
  private nextId = 1;

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

  // ── async メソッド（Phase A: インメモリエイリアス）────────────────────

  async getAsync(id: string): Promise<ChatMessageRecord | null> {
    return this.get(id);
  }

  async listByProjectAsync(projectId: string): Promise<ChatMessageRecord[]> {
    return this.listByProject(projectId);
  }

  async listAsync(): Promise<ChatMessageRecord[]> {
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
    return this.add(projectId, userId, userName, content, attachments, type);
  }

  async saveAsync(msg: ChatMessageRecord): Promise<void> {
    this.save(msg);
  }

  async deleteAsync(id: string): Promise<boolean> {
    return this.delete(id);
  }
}
