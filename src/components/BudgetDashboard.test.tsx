import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BudgetDashboard } from "./BudgetDashboard.js";

afterEach(cleanup);

const categories = [
  { name: "人件費", estimated: 1_000_000, actual: 900_000 },
  { name: "資材費", estimated: 500_000, actual: 600_000 },
  { name: "機材費", estimated: 200_000, actual: 0 },
  { name: "外注費", estimated: 300_000, actual: 300_000 },
  { name: "諸経費", estimated: 100_000, actual: 80_000 },
];

describe("BudgetDashboard", () => {
  it("renders project name label and summary totals", () => {
    render(<BudgetDashboard projectName="テスト案件" categories={categories} />);
    expect(screen.getByText("予算消化状況")).toBeDefined();
    // Estimated total: 2,100,000 / actual: 1,880,000 → under budget
    expect(screen.getByText("予算内")).toBeDefined();
  });

  it("shows all five category names in card view", () => {
    render(<BudgetDashboard projectName="テスト案件" categories={categories} />);
    for (const cat of categories) {
      expect(screen.getAllByText(cat.name).length).toBeGreaterThan(0);
    }
  });

  it("switches to table view when テーブル button is clicked", () => {
    render(<BudgetDashboard projectName="テスト案件" categories={categories} />);
    const tableBtn = screen.getAllByRole("button", { name: "テーブル" })[0];
    fireEvent.click(tableBtn!);
    // Table has column headers
    expect(screen.getByText("見積額")).toBeDefined();
    expect(screen.getByText("実績額")).toBeDefined();
    expect(screen.getByText("差額")).toBeDefined();
  });

  it("switches back to card view", () => {
    render(<BudgetDashboard projectName="テスト案件" categories={categories} />);
    const tableBtn = screen.getAllByRole("button", { name: "テーブル" })[0];
    fireEvent.click(tableBtn!);
    const cardBtn = screen.getAllByRole("button", { name: "カード" })[0];
    fireEvent.click(cardBtn!);
    // Back to card view — no table headers
    expect(screen.queryByText("見積額")).toBeNull();
  });

  it("shows over_budget status when actual exceeds estimated by >5%", () => {
    render(
      <BudgetDashboard
        projectName="超過案件"
        categories={[
          { name: "人件費", estimated: 100_000, actual: 200_000 },
          { name: "資材費", estimated: 0, actual: 0 },
          { name: "機材費", estimated: 0, actual: 0 },
          { name: "外注費", estimated: 0, actual: 0 },
          { name: "諸経費", estimated: 0, actual: 0 },
        ]}
      />,
    );
    expect(screen.getByText("予算超過")).toBeDefined();
  });

  it("renders with no categories prop without crashing", () => {
    render(<BudgetDashboard projectName="空案件" />);
    expect(screen.getByText("予算消化状況")).toBeDefined();
  });
});
