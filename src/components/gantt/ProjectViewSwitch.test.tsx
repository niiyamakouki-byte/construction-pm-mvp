import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectViewSwitch } from "./ProjectViewSwitch.js";

afterEach(() => cleanup());

describe("ProjectViewSwitch", () => {
  it("renders the four 工程 views and marks the active one", () => {
    render(<ProjectViewSwitch active="gantt" onSelect={() => {}} />);
    for (const label of ["今日", "一覧", "ガント", "カード"]) {
      expect(screen.getByRole("tab", { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.getByRole("tab", { name: /ガント/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /カード/ }).getAttribute("aria-selected")).toBe("false");
  });

  it("fires onSelect with the chosen view key", () => {
    const onSelect = vi.fn();
    render(<ProjectViewSwitch active="gantt" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /カード/ }));
    expect(onSelect).toHaveBeenCalledWith("cards");
    fireEvent.click(screen.getByRole("tab", { name: /今日/ }));
    expect(onSelect).toHaveBeenCalledWith("today");
  });
});
