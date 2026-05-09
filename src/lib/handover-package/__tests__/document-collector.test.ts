/**
 * document-collector unit tests.
 */

import { describe, it, expect } from "vitest";
import { collectDocumentsFromEquipment } from "../document-collector.js";

const COMPLETED_AT = "2025-04-01T00:00:00.000Z";

describe("collectDocumentsFromEquipment — base documents", () => {
  it("設備なしでも基本書類が生成される", () => {
    const docs = collectDocumentsFromEquipment([], COMPLETED_AT);
    const kinds = docs.map((d) => d.kind);
    expect(kinds).toContain("completion_inspection");
    expect(kinds).toContain("as_built_drawing");
    expect(kinds).toContain("aftercare_contact");
    expect(kinds).toContain("maintenance_schedule");
  });

  it("基本書類は最低4件生成される", () => {
    const docs = collectDocumentsFromEquipment([], COMPLETED_AT);
    expect(docs.length).toBeGreaterThanOrEqual(4);
  });
});

describe("collectDocumentsFromEquipment — エアコン", () => {
  it("エアコンから取扱説明書と保証書が生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "エアコン" }], COMPLETED_AT);
    const kinds = docs.map((d) => d.kind);
    expect(kinds).toContain("equipment_manual");
    expect(kinds).toContain("warranty_certificate");
  });

  it("エアコンの保証書に expiresAt が設定される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "エアコン" }], COMPLETED_AT);
    const warranty = docs.find((d) => d.kind === "warranty_certificate" && d.titleJa.includes("エアコン"));
    expect(warranty?.expiresAt).toBeTruthy();
  });

  it("エアコンの保証期間が12ヶ月後になっている", () => {
    const completed = new Date("2025-01-01T00:00:00.000Z");
    const docs = collectDocumentsFromEquipment([{ name: "エアコン" }], completed.toISOString());
    const warranty = docs.find((d) => d.kind === "warranty_certificate" && d.titleJa.includes("エアコン"));
    const expires = new Date(warranty!.expiresAt!);
    expect(expires.getFullYear()).toBe(2026);
    expect(expires.getMonth()).toBe(0); // January
  });
});

describe("collectDocumentsFromEquipment — 給湯器", () => {
  it("給湯器から取扱説明書と保証書が生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "給湯器" }], COMPLETED_AT);
    const kinds = docs.map((d) => d.kind);
    expect(kinds).toContain("equipment_manual");
    expect(kinds).toContain("warranty_certificate");
  });

  it("給湯器の保証期間が24ヶ月後になっている", () => {
    const completed = new Date("2025-01-01T00:00:00.000Z");
    const docs = collectDocumentsFromEquipment([{ name: "給湯器" }], completed.toISOString());
    const warranty = docs.find((d) => d.kind === "warranty_certificate" && d.titleJa.includes("給湯器"));
    const expires = new Date(warranty!.expiresAt!);
    expect(expires.getFullYear()).toBe(2027);
    expect(expires.getMonth()).toBe(0);
  });
});

describe("collectDocumentsFromEquipment — トイレ", () => {
  it("トイレのドキュメントが生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "トイレ" }], COMPLETED_AT);
    const titles = docs.map((d) => d.titleJa);
    expect(titles.some((t) => t.includes("トイレ"))).toBe(true);
  });
});

describe("collectDocumentsFromEquipment — 鍵", () => {
  it("鍵から鍵引渡し記録が生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "鍵" }], COMPLETED_AT);
    const kinds = docs.map((d) => d.kind);
    expect(kinds).toContain("key_handover_record");
  });
});

describe("collectDocumentsFromEquipment — 未知設備", () => {
  it("辞書にない設備でも取扱説明書が生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "謎の装置X" }], COMPLETED_AT);
    const manual = docs.find((d) => d.kind === "equipment_manual" && d.titleJa.includes("謎の装置X"));
    expect(manual).toBeTruthy();
  });
});

describe("collectDocumentsFromEquipment — 複数設備", () => {
  it("複数設備から書類が生成される", () => {
    const docs = collectDocumentsFromEquipment(
      [{ name: "エアコン" }, { name: "給湯器" }, { name: "IHコンロ" }],
      COMPLETED_AT,
    );
    // At minimum: base docs + manuals + warranties for each
    expect(docs.length).toBeGreaterThanOrEqual(4 + 2 * 3);
  });

  it("同じ種別の設備が重複して追加されない (seen チェック)", () => {
    const docs = collectDocumentsFromEquipment(
      [{ name: "エアコン" }, { name: "エアコン" }],
      COMPLETED_AT,
    );
    const airconWarranties = docs.filter(
      (d) => d.kind === "warranty_certificate" && d.titleJa.includes("エアコン"),
    );
    // Only 1 warranty for エアコン (same name = same key)
    expect(airconWarranties).toHaveLength(1);
  });
});

describe("collectDocumentsFromEquipment — maker / model", () => {
  it("メーカーと型番がコンテンツに含まれる", () => {
    const docs = collectDocumentsFromEquipment(
      [{ name: "エアコン", maker: "ダイキン", model: "F25ATES" }],
      COMPLETED_AT,
    );
    const manual = docs.find((d) => d.kind === "equipment_manual" && d.titleJa.includes("エアコン"));
    expect(manual?.contentJa).toContain("ダイキン");
    expect(manual?.contentJa).toContain("F25ATES");
  });
});

describe("collectDocumentsFromEquipment — IHコンロ", () => {
  it("IHコンロのドキュメントが生成される", () => {
    const docs = collectDocumentsFromEquipment([{ name: "IHコンロ" }], COMPLETED_AT);
    const titles = docs.map((d) => d.titleJa);
    expect(titles.some((t) => t.includes("IHコンロ"))).toBe(true);
  });
});

describe("collectDocumentsFromEquipment — ユニットバス", () => {
  it("ユニットバスの保証期間が24ヶ月後になっている", () => {
    const completed = new Date("2025-03-01T00:00:00.000Z");
    const docs = collectDocumentsFromEquipment([{ name: "ユニットバス" }], completed.toISOString());
    const warranty = docs.find((d) => d.kind === "warranty_certificate" && d.titleJa.includes("ユニットバス"));
    const expires = new Date(warranty!.expiresAt!);
    expect(expires.getFullYear()).toBe(2027);
    expect(expires.getMonth()).toBe(2); // March
  });
});
