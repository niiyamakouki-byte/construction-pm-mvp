/**
 * handover-package-facade unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createHandoverPackage,
  collectDocuments,
  scheduleMaintenanceMilestones,
  markReview,
  markDelivered,
  archivePackage,
  addDocument,
  removeDocument,
  getExpiringSoonDocuments,
  generateHandoverDocument,
  listProjectHandoverPackages,
  listHandoverPackagesByStatus,
  listRecentHandoverPackages,
  getHandoverPackage,
} from "../handover-package-facade.js";
import { _resetHandoverPackageStore } from "../handover-package-store.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

beforeEach(() => {
  localStorage.clear();
  _resetHandoverPackageStore();
});

describe("createHandoverPackage", () => {
  it("draft ステータスでパッケージが作成される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(pkg.status).toBe("draft");
    expect(pkg.projectId).toBe("proj-001");
    expect(pkg.ownerName).toBe("田中様");
    expect(pkg.documents).toHaveLength(0);
    expect(pkg.maintenanceSchedule).toHaveLength(0);
  });

  it("IDが自動生成される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(pkg.id).toMatch(/^hp-/);
  });

  it("ストアに保存される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const loaded = getHandoverPackage(pkg.id);
    expect(loaded).not.toBeNull();
  });
});

describe("collectDocuments", () => {
  it("エアコン設備でドキュメントが収集される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });

    const updated = collectDocuments(pkg.id, [{ name: "エアコン" }, { name: "給湯器" }]);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("documents_collected");
    expect(updated!.documents.length).toBeGreaterThan(0);
  });

  it("存在しないIDは null を返す", () => {
    const result = collectDocuments("nonexistent", []);
    expect(result).toBeNull();
  });
});

describe("scheduleMaintenanceMilestones", () => {
  it("デフォルトプリセットで7件のマイルストーンが生成される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = scheduleMaintenanceMilestones(pkg.id);
    expect(updated).not.toBeNull();
    expect(updated!.maintenanceSchedule).toHaveLength(7);
  });

  it("カスタムプリセットで指定件数のマイルストーンが生成される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = scheduleMaintenanceMilestones(pkg.id, [
      { intervalMonths: 6, descriptionJa: "半年点検" },
    ]);
    expect(updated!.maintenanceSchedule).toHaveLength(1);
  });

  it("存在しないIDは null を返す", () => {
    const result = scheduleMaintenanceMilestones("nonexistent");
    expect(result).toBeNull();
  });
});

describe("status transitions", () => {
  it("draft → review に遷移できる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = markReview(pkg.id);
    expect(updated?.status).toBe("review");
  });

  it("markDelivered で delivered になり deliveredAt が設定される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = markDelivered(pkg.id, "2025-03-01T00:00:00.000Z");
    expect(updated?.status).toBe("delivered");
    expect(updated?.deliveredAt).toBe("2025-03-01T00:00:00.000Z");
  });

  it("deliveredAt を省略すると現在時刻が設定される", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = markDelivered(pkg.id);
    expect(updated?.deliveredAt).toBeTruthy();
  });

  it("archivePackage で archived になる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = archivePackage(pkg.id);
    expect(updated?.status).toBe("archived");
  });

  it("存在しないIDの markReview は null を返す", () => {
    expect(markReview("nonexistent")).toBeNull();
  });
});

describe("addDocument / removeDocument", () => {
  it("ドキュメントを追加できる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const updated = addDocument(pkg.id, {
      id: "doc-custom",
      kind: "completion_inspection",
      titleJa: "完成検査報告書",
    });
    expect(updated?.documents).toHaveLength(1);
    expect(updated?.documents[0].id).toBe("doc-custom");
  });

  it("ドキュメントを削除できる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    addDocument(pkg.id, { id: "doc-1", kind: "equipment_manual", titleJa: "取扱説明書" });
    addDocument(pkg.id, { id: "doc-2", kind: "warranty_certificate", titleJa: "保証書" });
    const updated = removeDocument(pkg.id, "doc-1");
    expect(updated?.documents).toHaveLength(1);
    expect(updated?.documents[0].id).toBe("doc-2");
  });

  it("存在しないIDの addDocument は null を返す", () => {
    expect(addDocument("nonexistent", { id: "d1", kind: "equipment_manual", titleJa: "x" })).toBeNull();
  });
});

describe("getExpiringSoonDocuments", () => {
  it("30日以内に失効する書類を返す", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    addDocument(pkg.id, {
      id: "doc-exp",
      kind: "warranty_certificate",
      titleJa: "保証書",
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const expiring = getExpiringSoonDocuments(pkg.id, 30);
    expect(expiring).toHaveLength(1);
  });

  it("存在しないIDは空配列を返す", () => {
    expect(getExpiringSoonDocuments("nonexistent")).toHaveLength(0);
  });
});

describe("generateHandoverDocument", () => {
  it("markdown 形式で生成できる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const doc = generateHandoverDocument(pkg.id, "markdown");
    expect(doc).toContain("引渡しパッケージ");
  });

  it("html 形式で生成できる", () => {
    const pkg = createHandoverPackage({
      projectId: "proj-001",
      ownerName: "田中様",
      completedAt: "2025-01-01T00:00:00.000Z",
    });
    const doc = generateHandoverDocument(pkg.id, "html");
    expect(doc).toContain("<!DOCTYPE html>");
  });

  it("存在しないIDは null を返す", () => {
    expect(generateHandoverDocument("nonexistent", "markdown")).toBeNull();
  });
});

describe("queries", () => {
  it("listProjectHandoverPackages でプロジェクト別に取得できる", () => {
    createHandoverPackage({ projectId: "proj-A", ownerName: "A様", completedAt: "2025-01-01T00:00:00.000Z" });
    createHandoverPackage({ projectId: "proj-B", ownerName: "B様", completedAt: "2025-01-01T00:00:00.000Z" });
    expect(listProjectHandoverPackages("proj-A")).toHaveLength(1);
    expect(listProjectHandoverPackages("proj-B")).toHaveLength(1);
  });

  it("listHandoverPackagesByStatus でステータス別に取得できる", () => {
    const pkg = createHandoverPackage({ projectId: "proj-001", ownerName: "田中様", completedAt: "2025-01-01T00:00:00.000Z" });
    markDelivered(pkg.id, "2025-03-01T00:00:00.000Z");
    expect(listHandoverPackagesByStatus("delivered")).toHaveLength(1);
    expect(listHandoverPackagesByStatus("draft")).toHaveLength(0);
  });

  it("listRecentHandoverPackages で最近のパッケージを取得できる", () => {
    createHandoverPackage({ projectId: "proj-001", ownerName: "A様", completedAt: "2025-01-01T00:00:00.000Z" });
    createHandoverPackage({ projectId: "proj-002", ownerName: "B様", completedAt: "2025-01-01T00:00:00.000Z" });
    expect(listRecentHandoverPackages(10)).toHaveLength(2);
  });
});
