/**
 * VendorRatingPage — UI rendering tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { VendorRatingPage } from "../components/VendorRatingPage.js";
import { VendorEventStore } from "../lib/vendor-rating/event-store.js";
import type { Vendor } from "../lib/vendor-rating/recommendation-engine.js";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

function makeVendor(id: string, name: string): Vendor {
  return { id, name };
}

describe("VendorRatingPage", () => {
  beforeEach(() => {
    cleanup();
    localStorageMock.clear();
    VendorEventStore._reset();
  });

  it("renders page heading '業者評価'", () => {
    render(<VendorRatingPage vendors={[]} />);
    expect(screen.getByText("業者評価")).toBeDefined();
  });

  it("shows empty state when no vendors", () => {
    render(<VendorRatingPage vendors={[]} />);
    expect(screen.getByText("業者が登録されていません")).toBeDefined();
  });

  it("shows '発注時推奨' button", () => {
    render(<VendorRatingPage vendors={[]} />);
    expect(screen.getByText("発注時推奨")).toBeDefined();
  });

  it("renders vendor names in table", () => {
    const vendors = [makeVendor("v1", "田中工務店"), makeVendor("v2", "山田電気")];
    render(<VendorRatingPage vendors={vendors} />);
    expect(screen.getByText("田中工務店")).toBeDefined();
    expect(screen.getByText("山田電気")).toBeDefined();
  });

  it("renders table headers", () => {
    const vendors = [makeVendor("v1", "田中工務店")];
    render(<VendorRatingPage vendors={vendors} />);
    expect(screen.getByText("業者名")).toBeDefined();
    expect(screen.getByText("総合")).toBeDefined();
    expect(screen.getByText("納期")).toBeDefined();
    expect(screen.getByText("品質")).toBeDefined();
    expect(screen.getByText("価格")).toBeDefined();
  });

  it("clicking vendor row opens detail panel", () => {
    const vendors = [makeVendor("v1", "田中工務店")];
    render(<VendorRatingPage vendors={vendors} />);
    fireEvent.click(screen.getByText("田中工務店"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("detail panel shows vendor name", () => {
    const vendors = [makeVendor("v1", "田中工務店")];
    render(<VendorRatingPage vendors={vendors} />);
    fireEvent.click(screen.getByText("田中工務店"));
    // The detail panel has the vendor name in a heading
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("田中工務店");
  });

  it("closing detail panel via 閉じる button works", () => {
    const vendors = [makeVendor("v1", "田中工務店")];
    render(<VendorRatingPage vendors={vendors} />);
    fireEvent.click(screen.getByText("田中工務店"));
    const closeBtn = screen.getByLabelText("閉じる");
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking '発注時推奨' opens order modal", () => {
    render(<VendorRatingPage vendors={[makeVendor("v1", "A")]} />);
    fireEvent.click(screen.getByText("発注時推奨"));
    expect(screen.getByRole("dialog", { name: "発注時推奨" })).toBeDefined();
  });

  it("order modal shows category select", () => {
    render(<VendorRatingPage vendors={[makeVendor("v1", "A")]} />);
    fireEvent.click(screen.getByText("発注時推奨"));
    expect(screen.getByLabelText("工種カテゴリ")).toBeDefined();
  });

  it("detail panel shows スコア詳細 section", () => {
    const vendors = [makeVendor("v1", "田中工務店")];
    render(<VendorRatingPage vendors={vendors} />);
    fireEvent.click(screen.getByText("田中工務店"));
    expect(screen.getByText("スコア詳細")).toBeDefined();
  });
});
