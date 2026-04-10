/**
 * Drawing pin data management for construction drawing viewer.
 */

export type PinStatus = "未着手" | "対応中" | "完了";

export type DrawingPin = {
  id: string;
  /** x position as ratio of image width (0-1) */
  x: number;
  /** y position as ratio of image height (0-1) */
  y: number;
  comment: string;
  assignee: string;
  dueDate: string; // YYYY-MM-DD or ""
  status: PinStatus;
  createdAt: string; // ISO datetime
};

export const PIN_STATUSES: PinStatus[] = ["未着手", "対応中", "完了"];

export const PIN_STATUS_COLORS: Record<PinStatus, string> = {
  未着手: "#ef4444",
  対応中: "#f59e0b",
  完了: "#22c55e",
};

export function createPin(partial: Omit<DrawingPin, "id" | "createdAt">): DrawingPin {
  return {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function updatePin(pins: DrawingPin[], id: string, updates: Partial<Omit<DrawingPin, "id" | "createdAt">>): DrawingPin[] {
  return pins.map((p) => (p.id === id ? { ...p, ...updates } : p));
}

export function deletePin(pins: DrawingPin[], id: string): DrawingPin[] {
  return pins.filter((p) => p.id !== id);
}

const STORAGE_KEY_PREFIX = "drawing_pins_";

export function loadPins(drawingId: string): DrawingPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + drawingId);
    if (!raw) return [];
    return JSON.parse(raw) as DrawingPin[];
  } catch {
    return [];
  }
}

export function savePins(drawingId: string, pins: DrawingPin[]): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + drawingId, JSON.stringify(pins));
}
