import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoPage } from "../pages/PhotoPage.js";
import { navigate } from "../hooks/useHashRouter.js";
import type { Project } from "../domain/types.js";

let mockProjects: Project[] = [];
let mockPhotos: Array<{
  id: string;
  url: string;
  projectId: string;
  fileName: string;
  category?: string;
  caption?: string;
  takenAt: string;
}> = [];

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: vi.fn(async () => [...mockProjects]),
  }),
}));

vi.mock("../stores/photo-store.js", () => ({
  createPhotoStore: () => ({
    listPhotosByProject: vi.fn(async () => [...mockPhotos]),
  }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

function makeProject(): Project {
  const now = new Date().toISOString();
  return {
    id: "p-1",
    name: "品川物流センター新築",
    description: "",
    status: "active",
    startDate: "2026-05-27",
    includeWeekends: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe("PhotoPage", () => {
  beforeEach(() => {
    mockProjects = [makeProject()];
    mockPhotos = [];
    vi.mocked(navigate).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("写真がないとき、今日の写真アップロード導線を表示する", async () => {
    render(<PhotoPage />);

    await waitFor(() => {
      expect(screen.getByText("現場写真はまだありません")).toBeDefined();
    });

    expect(screen.getByText("今日の写真をアップロード")).toBeDefined();
  });

  it("主ボタンから今日の写真アップロードへ遷移する", async () => {
    render(<PhotoPage />);

    const uploadButton = await screen.findByText("今日の写真をアップロード");
    fireEvent.click(uploadButton);

    expect(navigate).toHaveBeenCalledWith("/today");
  });

  it("案件がないときは案件作成導線を表示する", async () => {
    mockProjects = [];

    render(<PhotoPage />);

    const createButton = await screen.findByText("案件を登録する");
    fireEvent.click(createButton);

    expect(navigate).toHaveBeenCalledWith("/app");
  });
});
