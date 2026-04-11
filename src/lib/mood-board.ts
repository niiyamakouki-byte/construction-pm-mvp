/**
 * ムードボード — Houzz Pro蒸留
 * 内装デザイン提案を視覚化するボードライブラリ
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type MoodBoardCategory =
  | "床"
  | "壁"
  | "天井"
  | "家具"
  | "照明"
  | "カーテン"
  | "その他";

export type MoodBoardItem = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  category: MoodBoardCategory;
  supplier?: string;
  price?: number;
  position: { x: number; y: number };
  size: { w: number; h: number };
};

export type MoodBoard = {
  id: string;
  projectId: string;
  title: string;
  items: MoodBoardItem[];
  createdAt: string;
};

// ── In-memory store ───────────────────────────────────────────────────────────

const store = new Map<string, MoodBoard>();

// ── ID generator ──────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Board CRUD ─────────────────────────────────────────────────────────────────

export function createMoodBoard(
  params: Omit<MoodBoard, "id" | "items" | "createdAt">,
): MoodBoard {
  const board: MoodBoard = {
    ...params,
    id: genId("mb"),
    items: [],
    createdAt: new Date().toISOString(),
  };
  store.set(board.id, board);
  return board;
}

export function getMoodBoard(id: string): MoodBoard | undefined {
  return store.get(id);
}

export function getMoodBoardsByProject(projectId: string): MoodBoard[] {
  return Array.from(store.values()).filter((b) => b.projectId === projectId);
}

export function updateMoodBoard(
  id: string,
  updates: Partial<Pick<MoodBoard, "title">>,
): MoodBoard | undefined {
  const board = store.get(id);
  if (!board) return undefined;
  const updated = { ...board, ...updates };
  store.set(id, updated);
  return updated;
}

export function deleteMoodBoard(id: string): boolean {
  return store.delete(id);
}

// ── Item CRUD ──────────────────────────────────────────────────────────────────

export function addMoodBoardItem(
  boardId: string,
  params: Omit<MoodBoardItem, "id">,
): MoodBoardItem | undefined {
  const board = store.get(boardId);
  if (!board) return undefined;
  const item: MoodBoardItem = { ...params, id: genId("mbi") };
  const updated = { ...board, items: [...board.items, item] };
  store.set(boardId, updated);
  return item;
}

export function updateMoodBoardItem(
  boardId: string,
  itemId: string,
  updates: Partial<Omit<MoodBoardItem, "id">>,
): MoodBoardItem | undefined {
  const board = store.get(boardId);
  if (!board) return undefined;
  const itemIndex = board.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return undefined;
  const updatedItem = { ...board.items[itemIndex], ...updates };
  const items = [...board.items];
  items[itemIndex] = updatedItem;
  store.set(boardId, { ...board, items });
  return updatedItem;
}

export function removeMoodBoardItem(
  boardId: string,
  itemId: string,
): boolean {
  const board = store.get(boardId);
  if (!board) return false;
  const filtered = board.items.filter((i) => i.id !== itemId);
  if (filtered.length === board.items.length) return false;
  store.set(boardId, { ...board, items: filtered });
  return true;
}

// ── Position/size helpers ──────────────────────────────────────────────────────

export function moveItem(
  boardId: string,
  itemId: string,
  position: { x: number; y: number },
): MoodBoardItem | undefined {
  return updateMoodBoardItem(boardId, itemId, { position });
}

export function resizeItem(
  boardId: string,
  itemId: string,
  size: { w: number; h: number },
): MoodBoardItem | undefined {
  return updateMoodBoardItem(boardId, itemId, { size });
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export function calcTotalPrice(board: MoodBoard): number {
  return board.items.reduce((sum, item) => sum + (item.price ?? 0), 0);
}

// ── Clear (for testing) ────────────────────────────────────────────────────────

export function clearMoodBoards(): void {
  store.clear();
}
