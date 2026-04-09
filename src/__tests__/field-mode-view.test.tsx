import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldModeView } from "../components/FieldModeView.js";

beforeEach(() => {
  cleanup();
});

const defaultProps = {
  projectName: "南青山ビル改装工事",
  projectId: "proj-001",
  onTakePhoto: vi.fn(),
  onCheckSchedule: vi.fn(),
  onDailyReport: vi.fn(),
};

describe("FieldModeView", () => {
  it("renders project name", () => {
    render(<FieldModeView {...defaultProps} />);
    expect(screen.getByText("南青山ビル改装工事")).toBeTruthy();
  });

  it("renders project id", () => {
    render(<FieldModeView {...defaultProps} />);
    expect(screen.getByText(/proj-001/)).toBeTruthy();
  });

  it("renders three core action buttons", () => {
    render(<FieldModeView {...defaultProps} />);
    expect(screen.getByText("写真撮影")).toBeTruthy();
    expect(screen.getByText("工程確認")).toBeTruthy();
    expect(screen.getByText("日報入力")).toBeTruthy();
  });

  it("calls onTakePhoto when photo button clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<FieldModeView {...defaultProps} onTakePhoto={handler} />);
    await user.click(screen.getByTestId("field-action-photo"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onCheckSchedule when schedule button clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<FieldModeView {...defaultProps} onCheckSchedule={handler} />);
    await user.click(screen.getByTestId("field-action-schedule"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onDailyReport when report button clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<FieldModeView {...defaultProps} onDailyReport={handler} />);
    await user.click(screen.getByTestId("field-action-report"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not render back button when onBack is not provided", () => {
    render(<FieldModeView {...defaultProps} />);
    expect(screen.queryByLabelText("戻る")).toBeNull();
  });

  it("renders back button when onBack is provided", () => {
    render(<FieldModeView {...defaultProps} onBack={vi.fn()} />);
    expect(screen.getByLabelText("戻る")).toBeTruthy();
  });

  it("calls onBack when back button clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<FieldModeView {...defaultProps} onBack={handler} />);
    await user.click(screen.getByLabelText("戻る"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renders extra actions", () => {
    render(
      <FieldModeView
        {...defaultProps}
        extraActions={[
          { key: "safety", label: "安全確認", icon: "⚠️", onClick: vi.fn() },
        ]}
      />,
    );
    expect(screen.getByText("安全確認")).toBeTruthy();
  });

  it("has field-mode-view test id", () => {
    render(<FieldModeView {...defaultProps} />);
    expect(screen.getByTestId("field-mode-view")).toBeTruthy();
  });
});
