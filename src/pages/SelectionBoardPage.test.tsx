import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SelectionBoardPage } from "./SelectionBoardPage.js";
import { clearSelectionStore } from "../lib/selection-board.js";

beforeEach(() => {
  clearSelectionStore();
});

afterEach(() => {
  cleanup();
  clearSelectionStore();
});

describe("SelectionBoardPage", () => {
  it("renders header with project title", () => {
    render(<SelectionBoardPage projectId="proj-test" />);
    expect(screen.getByText("施主セレクションボード")).toBeDefined();
  });

  it("renders category tabs for seeded demo items", () => {
    render(<SelectionBoardPage projectId="proj-tabs" />);
    const tabs = screen.getAllByRole("button").filter((b) => /^(床材|壁材|照明)/.test(b.textContent ?? ""));
    expect(tabs.length).toBeGreaterThanOrEqual(3);
  });

  it("shows items for active category (床材 by default)", () => {
    render(<SelectionBoardPage projectId="proj-cat" />);
    expect(screen.getByText("リビング床材")).toBeDefined();
  });

  it("switches category on tab click", () => {
    render(<SelectionBoardPage projectId="proj-switch" />);
    const wallTab = screen.getAllByText(/壁材/)[0];
    fireEvent.click(wallTab);
    expect(screen.getByText("リビング壁クロス")).toBeDefined();
  });

  it("shows approved count in header", () => {
    render(<SelectionBoardPage projectId="proj-count" />);
    expect(screen.getByText(/0\/\d+ 承認済/)).toBeDefined();
  });

  it("selects an option and enables approve button", () => {
    render(<SelectionBoardPage projectId="proj-approve" />);
    const optionButton = screen.getByText("オーク突板フローリング").closest("button")!;
    fireEvent.click(optionButton);
    const approveBtn = screen.getByText("承認");
    expect(approveBtn).toBeDefined();
    expect((approveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("approve button is disabled when no option selected", () => {
    render(<SelectionBoardPage projectId="proj-no-sel" />);
    const approveBtn = screen.getByText("承認") as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
  });

  it("hides approve button after approval", () => {
    render(<SelectionBoardPage projectId="proj-hide" />);
    const optionButton = screen.getByText("オーク突板フローリング").closest("button")!;
    fireEvent.click(optionButton);
    fireEvent.click(screen.getByText("承認"));
    expect(screen.queryByText("承認")).toBeNull();
  });
});
