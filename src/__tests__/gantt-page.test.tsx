import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GanttPage } from "../pages/GanttPage.js";

const mockTaskRepository = {
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockProjectRepository = {
  findAll: vi.fn(),
};

const mockContractorRepository = {
  findAll: vi.fn(),
};

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/contractor-store.js", () => ({
  createContractorRepository: () => mockContractorRepository,
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useGanttDrag.js", () => ({
  useGanttDrag: () => ({
    dragState: null,
    dragRef: { current: null },
    startTaskDrag: vi.fn(),
    startTaskResize: vi.fn(),
  }),
}));

describe("GanttPage", () => {
  beforeEach(() => {
    cleanup();
    mockTaskRepository.findAll.mockReset();
    mockProjectRepository.findAll.mockReset();
    mockContractorRepository.findAll.mockReset();
  });

  it("データ読込中はガント用スケルトンが表示される", () => {
    mockTaskRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockProjectRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockContractorRepository.findAll.mockReturnValueOnce(new Promise(() => {}));

    render(<GanttPage />);

    expect(
      screen.getByRole("status", { name: "ガントチャートを読み込み中" }),
    ).toBeDefined();
  });
});
