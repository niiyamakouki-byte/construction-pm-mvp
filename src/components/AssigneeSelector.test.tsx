import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssigneeSelector } from "./AssigneeSelector.js";

const MEMBERS = [
  { id: "member-1", name: "新山", role: "代表" },
  { id: "member-2", name: "佐藤", role: "専務" },
  { id: "member-3", name: "鈴木", role: "メンバー" },
];

afterEach(cleanup);

describe("AssigneeSelector", () => {
  it("renders the placeholder and all members by default", () => {
    render(<AssigneeSelector members={MEMBERS} onChange={() => undefined} />);

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "未割当",
      "新山 (代表)",
      "佐藤 (専務)",
      "鈴木 (メンバー)",
    ]);
  });

  it("filters members to representatives", () => {
    render(<AssigneeSelector members={MEMBERS} onChange={() => undefined} />);

    fireEvent.click(screen.getByTestId("assignee-role-filter-代表"));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "未割当",
      "新山 (代表)",
    ]);
  });

  it("filters members to executives", () => {
    render(<AssigneeSelector members={MEMBERS} onChange={() => undefined} />);

    fireEvent.click(screen.getByTestId("assignee-role-filter-専務"));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "未割当",
      "佐藤 (専務)",
    ]);
  });

  it("keeps the selected member visible even when another filter is active", () => {
    render(<AssigneeSelector members={MEMBERS} value="member-2" onChange={() => undefined} />);

    fireEvent.click(screen.getByTestId("assignee-role-filter-代表"));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "未割当",
      "佐藤 (専務)",
      "新山 (代表)",
    ]);
  });

  it("calls onChange with undefined when the placeholder is selected", () => {
    const handleChange = vi.fn();
    render(<AssigneeSelector members={MEMBERS} value="member-1" onChange={handleChange} />);

    fireEvent.change(screen.getByTestId("assignee-select"), {
      target: { value: "" },
    });

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });
});
