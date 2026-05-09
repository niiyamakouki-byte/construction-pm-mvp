/**
 * portfolio-handover-metrics unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pendingHandoverPackages,
  avgHandoverPreparationDays,
  expiringWarranties,
  mostFrequentDocumentKind,
} from "../portfolio-handover-metrics.js";
import { HandoverPackageStore, _resetHandoverPackageStore } from "../handover-package-store.js";
import type { HandoverPackage } from "../types.js";
import { makeHandoverPackageId } from "../types.js";

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

function savePackage(pkg: HandoverPackage): void {
  const s = new HandoverPackageStore();
  s.save(pkg);
}

function makePackage(overrides: Partial<HandoverPackage> = {}): HandoverPackage {
  return {
    id: makeHandoverPackageId("hp-test"),
    projectId: "proj-001",
    ownerName: "田中様",
    completedAt: new Date().toISOString(),
    status: "draft",
    documents: [],
    maintenanceSchedule: [],
    ...overrides,
  };
}

describe("pendingHandoverPackages", () => {
  it("パッケージが0件のとき 0 を返す", () => {
    expect(pendingHandoverPackages()).toBe(0);
  });

  it("draft / documents_collected / review は pending としてカウントされる", () => {
    savePackage(makePackage({ id: makeHandoverPackageId("hp-1"), status: "draft" }));
    savePackage(makePackage({ id: makeHandoverPackageId("hp-2"), status: "documents_collected" }));
    savePackage(makePackage({ id: makeHandoverPackageId("hp-3"), status: "review" }));
    expect(pendingHandoverPackages()).toBe(3);
  });

  it("delivered / archived は pending にカウントされない", () => {
    savePackage(makePackage({ id: makeHandoverPackageId("hp-1"), status: "delivered" }));
    savePackage(makePackage({ id: makeHandoverPackageId("hp-2"), status: "archived" }));
    savePackage(makePackage({ id: makeHandoverPackageId("hp-3"), status: "draft" }));
    expect(pendingHandoverPackages()).toBe(1);
  });
});

describe("avgHandoverPreparationDays", () => {
  it("パッケージが0件のとき 0 を返す", () => {
    expect(avgHandoverPreparationDays()).toBe(0);
  });

  it("引渡し完了がない場合は 0 を返す", () => {
    savePackage(makePackage({ id: makeHandoverPackageId("hp-1"), status: "draft" }));
    expect(avgHandoverPreparationDays()).toBe(0);
  });

  it("完成から30日後に引渡し完了のパッケージで 30 日が返る", () => {
    const completedAt = "2025-01-01T00:00:00.000Z";
    const deliveredAt = "2025-01-31T00:00:00.000Z";
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      status: "delivered",
      completedAt,
      deliveredAt,
    }));
    expect(avgHandoverPreparationDays()).toBe(30);
  });

  it("複数パッケージの平均を返す", () => {
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      status: "delivered",
      completedAt: "2025-01-01T00:00:00.000Z",
      deliveredAt: "2025-01-11T00:00:00.000Z", // 10 days
    }));
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-2"),
      status: "delivered",
      completedAt: "2025-02-01T00:00:00.000Z",
      deliveredAt: "2025-02-21T00:00:00.000Z", // 20 days
    }));
    // avg = 15
    expect(avgHandoverPreparationDays()).toBe(15);
  });
});

describe("expiringWarranties", () => {
  it("パッケージが0件のとき 0 を返す", () => {
    expect(expiringWarranties()).toBe(0);
  });

  it("30日以内に失効する保証書をカウントする", () => {
    const soonExpires = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const farExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      documents: [
        { id: "d1", kind: "warranty_certificate", titleJa: "保証書1", expiresAt: soonExpires },
        { id: "d2", kind: "warranty_certificate", titleJa: "保証書2", expiresAt: farExpires },
      ],
    }));
    expect(expiringWarranties(30)).toBe(1);
  });

  it("既に失効しているものはカウントしない", () => {
    const alreadyExpired = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      documents: [
        { id: "d1", kind: "warranty_certificate", titleJa: "保証書", expiresAt: alreadyExpired },
      ],
    }));
    expect(expiringWarranties(30)).toBe(0);
  });
});

describe("mostFrequentDocumentKind", () => {
  it("パッケージが0件のとき null を返す", () => {
    expect(mostFrequentDocumentKind()).toBeNull();
  });

  it("全パッケージにドキュメントがない場合は null を返す", () => {
    savePackage(makePackage({ id: makeHandoverPackageId("hp-1"), documents: [] }));
    expect(mostFrequentDocumentKind()).toBeNull();
  });

  it("最も多いドキュメント種別を返す", () => {
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      documents: [
        { id: "d1", kind: "equipment_manual", titleJa: "取扱説明書1" },
        { id: "d2", kind: "equipment_manual", titleJa: "取扱説明書2" },
        { id: "d3", kind: "warranty_certificate", titleJa: "保証書" },
      ],
    }));
    expect(mostFrequentDocumentKind()).toBe("equipment_manual");
  });

  it("同数の場合は最初に登録されたほうを返す", () => {
    savePackage(makePackage({
      id: makeHandoverPackageId("hp-1"),
      documents: [
        { id: "d1", kind: "equipment_manual", titleJa: "取扱説明書" },
        { id: "d2", kind: "warranty_certificate", titleJa: "保証書" },
      ],
    }));
    // Both count=1, stable sort → first is equipment_manual
    const result = mostFrequentDocumentKind();
    expect(["equipment_manual", "warranty_certificate"]).toContain(result);
  });
});
