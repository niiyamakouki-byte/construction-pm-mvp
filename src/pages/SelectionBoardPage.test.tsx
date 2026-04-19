import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SelectionBoardPage } from "./SelectionBoardPage.js";
import { clearSelectionStore, createSelectionItem } from "../lib/selection-board.js";

function seedFixtures(projectId: string): void {
  createSelectionItem({
    projectId,
    category: "床材",
    name: "リビング床材",
    options: [
      { id: "opt-floor-0", name: "オーク突板フローリング", description: "天然木突板・15mm厚", unitPrice: 12000 },
      { id: "opt-floor-1", name: "ビニル床タイル", description: "耐水性・抗菌仕様", unitPrice: 4500 },
    ],
  });
  createSelectionItem({
    projectId,
    category: "壁材",
    name: "リビング壁クロス",
    options: [
      { id: "opt-wall-0", name: "量産クロス白系", description: "SB仕様・防汚加工", unitPrice: 1200 },
      { id: "opt-wall-1", name: "珪藻土塗り壁", description: "調湿機能", unitPrice: 8500 },
    ],
  });
  createSelectionItem({
    projectId,
    category: "照明",
    name: "リビング照明",
    options: [
      { id: "opt-light-0", name: "パナソニック シーリングLED", description: "調光・調色対応", unitPrice: 25000 },
    ],
  });
}

async function renderPage(projectId: string) {
  const view = render(<SelectionBoardPage projectId={projectId} />);
  // Wait for async load
  await waitFor(() => {
    expect(screen.queryByText("読み込み中...")).toBeNull();
  });
  return view;
}

beforeEach(() => {
  clearSelectionStore();
});

afterEach(() => {
  cleanup();
  clearSelectionStore();
});

describe("SelectionBoardPage", () => {
  it("renders header with project title", async () => {
    seedFixtures("proj-test");
    await renderPage("proj-test");
    expect(screen.getByText("施主セレクションボード")).toBeDefined();
  });

  it("renders category tabs for items in the project", async () => {
    seedFixtures("proj-tabs");
    await renderPage("proj-tabs");
    const tabs = screen.getAllByRole("button").filter((b) => /^(床材|壁材|照明)/.test(b.textContent ?? ""));
    expect(tabs.length).toBeGreaterThanOrEqual(3);
  });

  it("shows items for active category (床材 by default)", async () => {
    seedFixtures("proj-cat");
    await renderPage("proj-cat");
    expect(screen.getByText("リビング床材")).toBeDefined();
  });

  it("switches category on tab click", async () => {
    seedFixtures("proj-switch");
    await renderPage("proj-switch");
    const wallTab = screen.getAllByText(/壁材/)[0];
    act(() => {
      fireEvent.click(wallTab);
    });
    expect(screen.getByText("リビング壁クロス")).toBeDefined();
  });

  it("shows approved count in header", async () => {
    seedFixtures("proj-count");
    await renderPage("proj-count");
    expect(screen.getByText(/0\/\d+ 承認済/)).toBeDefined();
  });

  it("selects an option and enables approve button", async () => {
    seedFixtures("proj-approve");
    await renderPage("proj-approve");
    const optionButton = screen.getByText("オーク突板フローリング").closest("button")!;
    act(() => {
      fireEvent.click(optionButton);
    });
    const approveBtn = screen.getByText("承認");
    expect(approveBtn).toBeDefined();
    expect((approveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("approve button is disabled when no option selected", async () => {
    seedFixtures("proj-no-sel");
    await renderPage("proj-no-sel");
    const approveBtn = screen.getByText("承認") as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
  });

  it("hides approve button after approval", async () => {
    seedFixtures("proj-hide");
    await renderPage("proj-hide");
    const optionButton = screen.getByText("オーク突板フローリング").closest("button")!;
    act(() => {
      fireEvent.click(optionButton);
    });
    act(() => {
      fireEvent.click(screen.getByText("承認"));
    });
    expect(screen.queryByText("承認")).toBeNull();
  });
});
