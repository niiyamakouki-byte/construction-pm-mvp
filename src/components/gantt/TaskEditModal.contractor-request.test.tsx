import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskEditModal } from "./TaskEditModal.js";
import type { TaskDetailState } from "./types.js";

const taskDetail: TaskDetailState = {
  task: {
    id: "task-1",
    projectId: "project-1",
    projectName: "南青山改修",
    name: "軽鉄下地組み",
    description: "",
    status: "todo",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    dueDate: "2026-08-12",
    progress: 0,
    dependencies: [],
    contractorId: "contractor-1",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  editName: "軽鉄下地組み",
  editStartDate: "2026-08-10",
  editDueDate: "2026-08-12",
  editIncludeWeekendsOverride: false,
  editIncludeWeekends: false,
  editAssigneeId: "",
  editContractorId: "contractor-1",
  editProgress: 0,
  editStatus: "todo",
  editMaterials: "",
  editLeadTimeDays: "",
  editDependencyType: "FS",
  saving: false,
};

afterEach(cleanup);

describe("TaskEditModal contractor request resend", () => {
  it("送信済み依頼は確認でキャンセルすると再送しない", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const send = vi.fn().mockResolvedValue({
      ok: false,
      requiresConfirmation: true,
      sentAt: "2026-08-05T00:00:00.000Z",
    });
    render(
      <TaskEditModal
        taskDetail={taskDetail}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
        onSendContractorRequest={send}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "業者へ依頼を送る" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("送信済みのため、再送をキャンセルしました。")).toBeDefined();
    confirm.mockRestore();
  });

  it("明示同意した場合だけallowResend付きで再送する", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: true,
        sentAt: "2026-08-05T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        recipient: "test@example.com",
        emailId: "email-2",
        shareUrl: "https://example.com/request-2",
      });
    render(
      <TaskEditModal
        taskDetail={taskDetail}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
        onSendContractorRequest={send}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "業者へ依頼を送る" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenNthCalledWith(2, { allowResend: true });
    expect(await screen.findByText("test@example.com へ依頼メールを送信しました。")).toBeDefined();
    confirm.mockRestore();
  });
});
