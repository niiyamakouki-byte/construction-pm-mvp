import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  EstimatePageErrorBoundary,
  GanttPageErrorBoundary,
  TodayDashboardPageErrorBoundary,
} from "../components/PageErrorBoundaries.js";

function Crash({ message }: { message: string }): ReactElement {
  throw new Error(message);
}

describe("page error boundaries", () => {
  beforeEach(() => {
    cleanup();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("TodayDashboardPage catches render errors with a page fallback", async () => {
    render(
      <TodayDashboardPageErrorBoundary>
        <Crash message="dashboard crash" />
      </TodayDashboardPageErrorBoundary>,
    );

    expect(await screen.findByText("ダッシュボードエラー")).toBeDefined();
    expect(screen.getByText("dashboard crash")).toBeDefined();
  });

  it("EstimatePage catches render errors with a page fallback", async () => {
    render(
      <EstimatePageErrorBoundary>
        <Crash message="estimate crash" />
      </EstimatePageErrorBoundary>,
    );

    expect(await screen.findByText("見積エラー")).toBeDefined();
    expect(screen.getByText("estimate crash")).toBeDefined();
  });

  it("GanttPage catches render errors with a page fallback", async () => {
    render(
      <GanttPageErrorBoundary>
        <Crash message="gantt crash" />
      </GanttPageErrorBoundary>,
    );

    expect(await screen.findByText("ガントチャートエラー")).toBeDefined();
    expect(screen.getByText("gantt crash")).toBeDefined();
  });
});
