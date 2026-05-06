import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProcurementPage } from "./ProcurementPage.js";
import type { Task } from "../domain/types.js";

const { useOrganizationContext, createTaskRepository, listByProjectAsync } = vi.hoisted(() => ({
  useOrganizationContext: vi.fn(),
  createTaskRepository: vi.fn(),
  listByProjectAsync: vi.fn(),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository,
}));

vi.mock("../lib/supabase-adapter/ProcurementRepository.js", () => ({
  ProcurementRepository: vi.fn(() => ({
    listByProjectAsync,
  })),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "壁材手配",
    description: "",
    status: "todo",
    assigneeId: "worker-1",
    startDate: today,
    dueDate: today,
    progress: 0,
    dependencies: [],
    leadTimeDays: 3,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProcurementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrganizationContext.mockReturnValue({ organizationId: "org-1" });
    listByProjectAsync.mockResolvedValue([]);
    createTaskRepository.mockReturnValue({
      findAll: vi.fn().mockResolvedValue([makeTask()]),
    });
  });

  it("shows procurement alerts derived from project tasks", async () => {
    render(<ProcurementPage projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("壁材手配")).toBeDefined();
    });
    expect(screen.getByText(/開始日:/).textContent).toContain("リードタイム: 3日");
  });
});
