/**
 * InspectionStore の CRUD + EventTarget + localStorage テスト
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── localStorage モック (jsdom 環境では clear() が未実装のため) ─────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

import {
  InspectionStore,
  getInspectionStore,
  _resetInspectionStore,
  type InspectionChangeEvent,
} from "../lib/photo-inspection/inspection-store.js";
import type { InspectionPhoto } from "../lib/photo-inspection/types.js";

// ── フィクスチャ ───────────────────────────────────────────────────────────────

function makePhotoInput(projectId = "proj-001"): Omit<InspectionPhoto, "id"> {
  return {
    projectId,
    capturedAt: "2026-05-09T10:00:00Z",
    imageUrl: "data:image/png;base64,abc",
    fileName: "test.jpg",
    defects: [],
    status: "pending",
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("InspectionStore — 基本 CRUD", () => {
  let store: InspectionStore;

  beforeEach(() => {
    localStorage.clear();
    store = new InspectionStore();
  });

  it("初期状態: photos が空", () => {
    expect(store.photos).toHaveLength(0);
  });

  it("add: 写真を追加して id を自動生成", () => {
    const photo = store.add(makePhotoInput());
    expect(photo.id).toBeTruthy();
    expect(store.photos).toHaveLength(1);
  });

  it("add: 連続追加で id が重複しない", () => {
    const p1 = store.add(makePhotoInput());
    const p2 = store.add(makePhotoInput());
    expect(p1.id).not.toBe(p2.id);
  });

  it("getById: 存在するIDで取得できる", () => {
    const photo = store.add(makePhotoInput());
    expect(store.getById(photo.id)).toEqual(photo);
  });

  it("getById: 存在しないIDで undefined", () => {
    expect(store.getById("nonexistent")).toBeUndefined();
  });

  it("update: フィールドを更新できる", () => {
    const photo = store.add(makePhotoInput());
    const updated = store.update(photo.id, { status: "approved" });
    expect(updated?.status).toBe("approved");
    expect(store.getById(photo.id)?.status).toBe("approved");
  });

  it("update: 存在しないIDで null", () => {
    expect(store.update("nonexistent", { status: "approved" })).toBeNull();
  });

  it("remove: 写真を削除できる", () => {
    const photo = store.add(makePhotoInput());
    const result = store.remove(photo.id);
    expect(result).toBe(true);
    expect(store.photos).toHaveLength(0);
  });

  it("remove: 存在しないIDで false", () => {
    expect(store.remove("nonexistent")).toBe(false);
  });

  it("setStatus: ステータスを更新", () => {
    const photo = store.add(makePhotoInput());
    store.setStatus(photo.id, "rework");
    expect(store.getById(photo.id)?.status).toBe("rework");
  });

  it("clearAll: 全写真を削除", () => {
    store.add(makePhotoInput());
    store.add(makePhotoInput());
    store.clearAll();
    expect(store.photos).toHaveLength(0);
  });
});

describe("InspectionStore — クエリ", () => {
  let store: InspectionStore;

  beforeEach(() => {
    localStorage.clear();
    store = new InspectionStore();
  });

  it("queryByProject: 特定プロジェクトの写真のみ返す", () => {
    store.add(makePhotoInput("proj-001"));
    store.add(makePhotoInput("proj-001"));
    store.add(makePhotoInput("proj-002"));
    expect(store.queryByProject("proj-001")).toHaveLength(2);
    expect(store.queryByProject("proj-002")).toHaveLength(1);
  });

  it("queryByProject: 存在しないプロジェクト → 空配列", () => {
    expect(store.queryByProject("proj-999")).toHaveLength(0);
  });

  it("listPending: pending ステータスの写真のみ", () => {
    const p1 = store.add(makePhotoInput());
    store.add({ ...makePhotoInput(), status: "approved" });
    expect(store.listPending()).toHaveLength(1);
    expect(store.listPending()[0].id).toBe(p1.id);
  });

  it("listPending: 全員 approved の場合は空", () => {
    store.add({ ...makePhotoInput(), status: "approved" });
    store.add({ ...makePhotoInput(), status: "approved" });
    expect(store.listPending()).toHaveLength(0);
  });
});

describe("InspectionStore — EventTarget", () => {
  let store: InspectionStore;

  beforeEach(() => {
    localStorage.clear();
    store = new InspectionStore();
  });

  it("add → 'change' イベントが発火する", () => {
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.add(makePhotoInput());
    expect(fired).toBe(true);
  });

  it("update → 'change' イベントが発火する", () => {
    const photo = store.add(makePhotoInput());
    let count = 0;
    store.addEventListener("change", () => { count++; });
    store.update(photo.id, { status: "approved" });
    expect(count).toBe(1);
  });

  it("remove → 'change' イベントが発火する", () => {
    const photo = store.add(makePhotoInput());
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.remove(photo.id);
    expect(fired).toBe(true);
  });

  it("clearAll → 'change' イベントが発火する", () => {
    store.add(makePhotoInput());
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.clearAll();
    expect(fired).toBe(true);
  });

  it("イベントの detail.photos に最新リストが入る", () => {
    let eventPhotos: InspectionPhoto[] = [];
    store.addEventListener("change", (e) => {
      eventPhotos = (e as InspectionChangeEvent).detail.photos;
    });
    store.add(makePhotoInput());
    expect(eventPhotos).toHaveLength(1);
  });
});

describe("InspectionStore — localStorage 永続化", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("追加した写真が localStorage に保存される", () => {
    const store = new InspectionStore();
    store.add(makePhotoInput());
    expect(localStorage.getItem("genbahub_inspection_photos")).toBeTruthy();
  });

  it("新しいインスタンスが localStorage から復元する", () => {
    const store1 = new InspectionStore();
    store1.add(makePhotoInput());
    const store2 = new InspectionStore();
    expect(store2.photos).toHaveLength(1);
  });

  it("clearAll 後は localStorage も空", () => {
    const store = new InspectionStore();
    store.add(makePhotoInput());
    store.clearAll();
    const raw = localStorage.getItem("genbahub_inspection_photos");
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed).toHaveLength(0);
  });
});

describe("InspectionStore シングルトン", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInspectionStore();
  });

  it("getInspectionStore は常に同じインスタンスを返す", () => {
    const a = getInspectionStore();
    const b = getInspectionStore();
    expect(a).toBe(b);
  });

  it("_resetInspectionStore 後は新しいインスタンス", () => {
    const a = getInspectionStore();
    _resetInspectionStore();
    const b = getInspectionStore();
    expect(a).not.toBe(b);
  });
});
