/**
 * GenbaHub Critical修正 bead 6grza — サンプル商談表示の回帰テスト。
 * Author: Codex
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalesPipelinePage } from "./SalesPipelinePage.js";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
  });
});
afterEach(() => cleanup());

describe("SalesPipelinePage sample data", () => {
  it("サンプル明示と空状態開始を提供する", async () => {
    render(<SalesPipelinePage />);

    expect(await screen.findByText("サンプルデータ")).toBeDefined();
    expect(screen.getByText("操作体験用の架空の商談です")).toBeDefined();
    expect(document.body.textContent).not.toContain("新山光輝");

    fireEvent.click(screen.getByRole("button", { name: "空状態から始める" }));
    await waitFor(() => expect(screen.queryByText("サンプルデータ")).toBeNull());
    expect(screen.getAllByText("0件").length).toBeGreaterThan(0);
  });
});
