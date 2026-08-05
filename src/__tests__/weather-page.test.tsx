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
    vi.unstubAllGlobals();
  });

  it("renders a seven-day site forecast with construction warnings when the API succeeds", async () => {
    mockProjects = [makeProject({ latitude: 35.68, longitude: 139.76 })];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          daily: {
            time: Array.from({ length: 7 }, (_, i) => `2026-08-${String(6 + i).padStart(2, "0")}`),
            weather_code: [65, 65, 65, 65, 65, 65, 65],
            temperature_2m_max: [27, 27, 27, 27, 27, 27, 27],
            temperature_2m_min: [21, 21, 21, 21, 21, 21, 21],
            precipitation_probability_max: [90, 90, 90, 90, 90, 90, 90],
            wind_speed_10m_max: [18, 18, 18, 18, 18, 18, 18],
          },
        }),
      })),
    );

    render(<WeatherPage />);

    expect(await screen.findByRole("heading", { name: "現場天気" })).toBeDefined();
    expect(screen.getByText("施工現場を選択")).toBeDefined();
    expect(screen.getAllByText("施工影響")).toHaveLength(7);
    expect(screen.getAllByText("延期推奨").length).toBeGreaterThan(0);
    expect(screen.queryByText(/取得できません/)).toBeNull();
  });

  // 座標未設定案件に合成データを実予報として出さない (bead laporta-beads-pr4zs)
  it("shows an honest unavailable message instead of synthetic data when location is unset", async () => {
    mockProjects = [makeProject()]; // 緯度経度なし

    render(<WeatherPage />);

    expect(await screen.findByText(/の天候情報を取得できません/)).toBeDefined();
    expect(screen.getByText(/住所（緯度・経度）が未設定です/)).toBeDefined();
    expect(screen.queryByText("施工影響")).toBeNull();
    expect(screen.queryByText("延期推奨")).toBeNull();
  });

  // Open-Meteo API失敗時、合成データ(createMockForecast)を実予報として出さない (bead laporta-beads-pr4zs)
  it("shows an honest unavailable message instead of synthetic data when the API fails", async () => {
    mockProjects = [makeProject({ latitude: 35.68, longitude: 139.76 })];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    render(<WeatherPage />);

    expect(await screen.findByText(/の天候情報を取得できません/)).toBeDefined();
    expect(screen.getByText(/取得に失敗しました/)).toBeDefined();
    expect(screen.queryByText("施工影響")).toBeNull();
    expect(screen.queryByText("延期推奨")).toBeNull();
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
