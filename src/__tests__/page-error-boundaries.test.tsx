import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

describe("page error boundaries", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unmock("../contexts/OrganizationContext.js");
    vi.unmock("../contexts/PersonaContext.js");
    vi.unmock("../estimate/estimate-generator.js");
  });

  it("TodayDashboardPage catches render errors with a page fallback", async () => {
    vi.doMock("../contexts/OrganizationContext.js", () => ({
      useOrganizationContext: () => {
        throw new Error("dashboard crash");
      },
    }));
    vi.doMock("../contexts/PersonaContext.js", () => ({
      usePersona: () => ({ persona: "worker" }),
    }));

    const { TodayDashboardPage } = await import("../pages/TodayDashboardPage.js");
    render(<TodayDashboardPage />);

    expect(await screen.findByText("ダッシュボードエラー")).toBeDefined();
    expect(screen.getByText("dashboard crash")).toBeDefined();
  });

  it("EstimatePage catches render errors with a page fallback", async () => {
    vi.doMock("../estimate/estimate-generator.js", () => ({
      generateEstimate: vi.fn(),
      listCategories: () => {
        throw new Error("estimate crash");
      },
      listItemsByCategory: vi.fn(() => []),
    }));

    const { EstimatePage } = await import("../pages/EstimatePage.js");
    render(<EstimatePage />);

    expect(await screen.findByText("見積エラー")).toBeDefined();
    expect(screen.getByText("estimate crash")).toBeDefined();
  });

  it("GanttPage catches render errors with a page fallback", async () => {
    vi.doMock("../contexts/OrganizationContext.js", () => ({
      useOrganizationContext: () => {
        throw new Error("gantt crash");
      },
    }));

    const { GanttPage } = await import("../pages/GanttPage.js");
    render(<GanttPage />);

    expect(await screen.findByText("ガントチャートエラー")).toBeDefined();
    expect(screen.getByText("gantt crash")).toBeDefined();
  });
});
