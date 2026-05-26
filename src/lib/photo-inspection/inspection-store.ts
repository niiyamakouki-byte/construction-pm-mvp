/**
 * InspectionStore — 検査写真の CRUD + localStorage 永続化
 *
 * EventTarget を継承し、データ変化時に "change" CustomEvent を dispatch する。
 */

import type { InspectionPhoto, PhotoStatus } from "./types.js";

// ── uuid相当の簡易ID生成 ─────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── イベント型 ────────────────────────────────────────────────────────────────

export type InspectionChangeEvent = CustomEvent<{ photos: InspectionPhoto[] }>;

// ── ストア ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "genbahub_inspection_photos";

export class InspectionStore extends EventTarget {
  private _photos: InspectionPhoto[] = [];

  constructor() {
    super();
    this._load();
  }

  // ── 読み込み ────────────────────────────────────────────────────────────────

  get photos(): InspectionPhoto[] {
    return this._photos;
  }

  getById(id: string): InspectionPhoto | undefined {
    return this._photos.find((p) => p.id === id);
  }

  queryByProject(projectId: string): InspectionPhoto[] {
    return this._photos.filter((p) => p.projectId === projectId);
  }

  listPending(): InspectionPhoto[] {
    return this._photos.filter((p) => p.status === "pending");
  }

  // ── 書き込み ────────────────────────────────────────────────────────────────

  add(photo: Omit<InspectionPhoto, "id">): InspectionPhoto {
    const newPhoto: InspectionPhoto = { ...photo, id: genId() };
    this._photos = [...this._photos, newPhoto];
    this._persist();
    this._emit();
    return newPhoto;
  }

  update(id: string, patch: Partial<Omit<InspectionPhoto, "id">>): InspectionPhoto | null {
    const idx = this._photos.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const updated = { ...this._photos[idx], ...patch };
    this._photos = [
      ...this._photos.slice(0, idx),
      updated,
      ...this._photos.slice(idx + 1),
    ];
    this._persist();
    this._emit();
    return updated;
  }

  remove(id: string): boolean {
    const before = this._photos.length;
    this._photos = this._photos.filter((p) => p.id !== id);
    if (this._photos.length === before) return false;
    this._persist();
    this._emit();
    return true;
  }

  setStatus(id: string, status: PhotoStatus): InspectionPhoto | null {
    return this.update(id, { status });
  }

  clearAll(): void {
    this._photos = [];
    this._persist();
    this._emit();
  }

  // ── 永続化 ──────────────────────────────────────────────────────────────────

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._photos = JSON.parse(raw) as InspectionPhoto[];
      }
    } catch {
      this._photos = [];
    }
  }

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._photos));
    } catch {
      // localStorage が使えない環境では無視
    }
  }

  private _emit(): void {
    const event: InspectionChangeEvent = new CustomEvent("change", {
      detail: { photos: this._photos },
    });
    this.dispatchEvent(event);
  }
}

// ── シングルトン ──────────────────────────────────────────────────────────────

let _instance: InspectionStore | null = null;

export function getInspectionStore(): InspectionStore {
  if (!_instance) {
    _instance = new InspectionStore();
  }
  return _instance;
}

export function _resetInspectionStore(): void {
  _instance = null;
}
