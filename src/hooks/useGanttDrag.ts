import { useCallback, useEffect, useRef, useState } from "react";
import type { Contractor, Task } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";
import type { DragState, GanttTask } from "../components/gantt/types.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import {
  addDays,
  addDaysSkipWeekends,
  daysBetween,
} from "../components/gantt/utils.js";

type UseGanttDragOptions = {
  ganttTasks: GanttTask[];
  contractors: Contractor[];
  dayWidth: number;
  organizationId: string | null;
  taskRepository: Repository<Task>;
  loadData: () => Promise<void>;
  onError: (message: string) => void;
};

type DragStartPointerEvent = React.PointerEvent<HTMLElement>;

const createDragState = (
  task: GanttTask,
  type: DragState["type"],
  startX: number,
): DragState => ({
  taskId: task.id,
  type,
  startX,
  originalStartDate: task.startDate,
  originalEndDate: task.endDate,
  previewStartDate: task.startDate,
  previewEndDate: task.endDate,
});

export function useGanttDrag({
  ganttTasks,
  contractors,
  dayWidth,
  organizationId,
  taskRepository,
  loadData,
  onError,
}: UseGanttDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const startDrag = useCallback(
    (task: GanttTask, type: DragState["type"], event: DragStartPointerEvent) => {
      if (event.pointerType !== "touch" && event.button !== 0) return;
      event.preventDefault();

      const nextDrag = createDragState(task, type, event.clientX);
      dragRef.current = nextDrag;
      setDragState(nextDrag);
    },
    [],
  );

  const startTaskDrag = useCallback(
    (task: GanttTask, event: DragStartPointerEvent) => {
      startDrag(task, "move", event);
    },
    [startDrag],
  );

  const startTaskResize = useCallback(
    (task: GanttTask, event: DragStartPointerEvent) => {
      event.stopPropagation();
      startDrag(task, "resize", event);
    },
    [startDrag],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaDays = Math.round((event.clientX - drag.startX) / dayWidth);
      const draggedTask = ganttTasks.find((task) => task.id === drag.taskId);
      const skipWeekends = draggedTask ? !draggedTask.projectIncludesWeekends : false;
      const addFn = skipWeekends ? addDaysSkipWeekends : addDays;

      let previewStartDate = drag.originalStartDate;
      let previewEndDate = drag.originalEndDate;

      if (drag.type === "move") {
        previewStartDate = addFn(drag.originalStartDate, deltaDays);
        previewEndDate = addFn(drag.originalEndDate, deltaDays);
      } else {
        const originalDuration = daysBetween(
          drag.originalStartDate,
          drag.originalEndDate,
        );
        const newDuration = Math.max(1, originalDuration + deltaDays);
        previewEndDate = addFn(drag.originalStartDate, newDuration);
      }

      const nextDrag = { ...drag, previewStartDate, previewEndDate };
      dragRef.current = nextDrag;
      setDragState(nextDrag);
    };

    const handlePointerUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;

      dragRef.current = null;
      setDragState(null);

      if (
        drag.previewStartDate === drag.originalStartDate &&
        drag.previewEndDate === drag.originalEndDate
      ) {
        return;
      }

      try {
        await taskRepository.update(drag.taskId, {
          startDate: drag.previewStartDate,
          dueDate: drag.previewEndDate,
          updatedAt: new Date().toISOString(),
        });

        if (drag.previewStartDate !== drag.originalStartDate) {
          const movedTask = ganttTasks.find((task) => task.id === drag.taskId);
          if (movedTask?.contractorId) {
            const contractor = contractors.find(
              (item) => item.id === movedTask.contractorId,
            );
            const notificationRepository = createNotificationRepository(
              () => organizationId,
            );
            const now = new Date();

            await notificationRepository.create({
              id: crypto.randomUUID(),
              projectId: movedTask.projectId,
              taskId: movedTask.id,
              contractorId: movedTask.contractorId,
              type: "schedule_changed",
              message: `${movedTask.name}の開始日が${drag.previewStartDate}に変更されました。（業者: ${contractor?.name ?? "不明"}）`,
              status: "pending",
              scheduledAt: now.toISOString(),
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            });
          }
        }

        await loadData();
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "タスクの更新に失敗しました",
        );
      }
    };

    const pointerUpHandler = () => {
      void handlePointerUp();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", pointerUpHandler);
    window.addEventListener("pointercancel", pointerUpHandler);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", pointerUpHandler);
      window.removeEventListener("pointercancel", pointerUpHandler);
    };
  }, [
    contractors,
    dayWidth,
    ganttTasks,
    loadData,
    onError,
    organizationId,
    taskRepository,
  ]);

  return {
    dragState,
    dragRef,
    startTaskDrag,
    startTaskResize,
  };
}
