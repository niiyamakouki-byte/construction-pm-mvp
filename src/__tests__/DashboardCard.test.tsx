import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { DashboardCard } from "../components/DashboardCard.js";

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover: _wh,
      ...rest
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown }) => (
      <button {...rest}>{children}</button>
    ),
  },
}));

afterEach(() => cleanup());

describe("DashboardCard", () => {
  it("title と value を表示する", () => {
    render(<DashboardCard title="今日の予定" value="3件" />);
    expect(screen.getByText("今日の予定")).toBeDefined();
    expect(screen.getByText("3件")).toBeDefined();
  });

  it("subtext を表示する", () => {
    render(<DashboardCard title="今日の予定" value="3件" subtext="会議含む" />);
    expect(screen.getByText("会議含む")).toBeDefined();
  });

  it("icon を表示する", () => {
    render(<DashboardCard title="今日の予定" value="3件" icon="📅" />);
    expect(screen.getByText("📅")).toBeDefined();
  });

  it("icon が未指定の場合は icon 要素がない", () => {
    const { container } = render(<DashboardCard title="今日の予定" value="3件" />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("onClick が発火する", () => {
    const onClick = vi.fn();
    render(<DashboardCard title="今日の予定" value="3件" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("accent=primary で primary スタイルが適用される", () => {
    const { container } = render(
      <DashboardCard title="A" value="1" accent="primary" icon="X" />,
    );
    expect(container.querySelector(".bg-brand-100")).toBeDefined();
  });

  it("accent=warning で warning スタイルが適用される", () => {
    const { container } = render(
      <DashboardCard title="A" value="1" accent="warning" icon="X" />,
    );
    expect(container.querySelector(".bg-amber-100")).toBeDefined();
  });

  it("accent=success で success スタイルが適用される", () => {
    const { container } = render(
      <DashboardCard title="A" value="1" accent="success" icon="X" />,
    );
    expect(container.querySelector(".bg-brand-100")).toBeDefined();
  });

  it("accent=warm で warm スタイルが適用される", () => {
    const { container } = render(
      <DashboardCard title="A" value="1" accent="warm" icon="X" />,
    );
    expect(container.querySelector(".bg-orange-100")).toBeDefined();
  });
});
