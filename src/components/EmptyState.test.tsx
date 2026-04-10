import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders title", () => {
    render(<EmptyState title="タスクがありません" />);
    expect(screen.getByText("タスクがありません")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="タイトル" description="説明文です" />);
    expect(screen.getByText("説明文です")).toBeDefined();
  });

  it("does not render description when omitted", () => {
    render(<EmptyState title="タイトル" />);
    expect(screen.queryByText("説明文です")).toBeNull();
  });

  it("renders action button and calls onAction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState title="タイトル" actionLabel="追加する" onAction={onAction} />,
    );
    const button = screen.getByRole("button", { name: "追加する" });
    await user.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render button when actionLabel is missing", () => {
    render(<EmptyState title="タイトル" onAction={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders icon when provided", () => {
    render(
      <EmptyState
        title="タイトル"
        icon={<span data-testid="icon">icon</span>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeDefined();
  });
});
