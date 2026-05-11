/**
 * 工程テンプレートライブラリ — LocalStorage CRUD
 *
 * gantt-master-preset.ts と同じ localStorage パターン。
 * No DOM / No React dependencies.
 */

import type { PhaseTemplate } from "./types.js";

const STORAGE_KEY = "genbahub:phase-templates";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage) return null;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
}

function readAll(): PhaseTemplate[] {
  try {
    const raw = getLocalStorage()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PhaseTemplate[];
  } catch {
    return [];
  }
}

function writeAll(templates: PhaseTemplate[]): void {
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // localStorage unavailable or quota exceeded — silent
  }
}

/** 全テンプレートを返す (createdAt 降順) */
export function listPhaseTemplates(): PhaseTemplate[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** IDでテンプレートを取得 */
export function getPhaseTemplate(id: string): PhaseTemplate | undefined {
  return readAll().find((t) => t.id === id);
}

/** テンプレートを保存 (上書き or 新規) */
export function savePhaseTemplate(template: PhaseTemplate): void {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    all[idx] = template;
  } else {
    all.push(template);
  }
  writeAll(all);
}

/** テンプレートを削除 */
export function deletePhaseTemplate(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id));
}
