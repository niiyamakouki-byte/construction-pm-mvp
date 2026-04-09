import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { WeatherPage } from "../pages/WeatherPage.js";
import type { Project } from "../domain/types.js";

let mockProjects: Project[] = [];
const mockFindAll = vi.fn(async () => [...mockProjects]);

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: mockFindAll,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "品川駅南口改修",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WeatherPage", () => {
  beforeEach(() => {
    cleanup();
    mockProjects = [];
    mockFindAll.mockClear();
  });

  it("renders a seven-day site forecast with construction warnings", async () => {
    mockProjects = [makeProject()];

    render(<WeatherPage />);

    expect(await screen.findByRole("heading", { name: "現場天気" })).toBeDefined();
    expect(screen.getByText("施工現場を選択")).toBeDefined();
    expect(screen.getAllByText("Construction Impact")).toHaveLength(7);
    expect(screen.getAllByText("延期推奨").length).toBeGreaterThan(0);
  });

  it("shows a load error when project data fails", async () => {
    mockFindAll.mockRejectedValueOnce(new Error("weather load failed"));

    render(<WeatherPage />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("weather load failed");
    });
  });
});
