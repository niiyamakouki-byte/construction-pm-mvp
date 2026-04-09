import { useCallback, useEffect, useRef, useState } from "react";
import type { Contractor, Task } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";
import type { DragState, GanttTask } from "../components/gantt/types.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import {
  addDaysBySchedule,
  daysBetween,
} from "../components/gantt/utils.js";
import { cascadeSchedule } from "../lib/cascade-scheduler.js";

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

const LONG_PRESS_MS = 400;
const SCROLL_TOLERANCE = 8; // px – if finger moves more than this, cancel long press

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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDragRef = useRef<{ task: GanttTask; type: DragState["type"]; startX: number; startY: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingDragRef.current = null;
  }, []);

  const activateDrag = useCallback(
    (task: GanttTask, type: DragState["type"], startX: number) => {
      const nextDrag = createDragState(task, type, startX);
      dragRef.current = nextDrag;
      setDragState(nextDrag);
    },
    [],
  );

  const startDrag = useCallback(
    (task: GanttTask, type: DragState["type"], event: DragStartPointerEvent) => {
      if (event.pointerType !== "touch" && event.button !== 0) return;

      // Mouse: start immediately
      if (event.pointerType !== "touch") {
        event.preventDefault();
        activateDrag(task, type, event.clientX);
        return;
      }

      // Touch: require long press to avoid scroll conflict
      pendingDragRef.current = { task, type, startX: event.clientX, startY: event.clientY };
      longPressTimerRef.current = setTimeout(() => {
        const pending = pendingDragRef.current;
        if (pending) {
          activateDrag(pending.task, pending.type, pending.startX);
          // Haptic feedback hint (vibration)
          navigator.vibrate?.(30);
        }
        longPressTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [activateDrag],
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
      // Cancel long press if finger moved too far (user is scrolling)
      const pending = pendingDragRef.current;
      if (pending && !dragRef.current) {
        const dx = Math.abs(event.clientX - pending.startX);
        const dy = Math.abs(event.clientY - pending.startY);
        if (dx > SCROLL_TOLERANCE || dy > SCROLL_TOLERANCE) {
          cancelLongPress();
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      const deltaDays = Math.round((event.clientX - drag.startX) / dayWidth);
      const draggedTask = ganttTasks.find((task) => task.id === drag.taskId);

      let previewStartDate = drag.originalStartDate;
      let previewEndDate = drag.originalEndDate;

      if (drag.type === "move") {
        previewStartDate = draggedTask
          ? addDaysBySchedule(
            drag.originalStartDate,
            deltaDays,
            draggedTask.projectIncludesWeekends,
            draggedTask.includeWeekends,
          )
          : drag.originalStartDate;
        previewEndDate = draggedTask
          ? addDaysBySchedule(
            drag.originalEndDate,
            deltaDays,
            draggedTask.projectIncludesWeekends,
            draggedTask.includeWeekends,
          )
          : drag.originalEndDate;
      } else {
        const originalDuration = daysBetween(
          drag.originalStartDate,
          drag.originalEndDate,
        );
        const newDuration = Math.max(1, originalDuration + deltaDays);
        previewEndDate = draggedTask
          ? addDaysBySchedule(
            drag.originalStartDate,
            newDuration,
            draggedTask.projectIncludesWeekends,
            draggedTask.includeWeekends,
          )
          : drag.originalEndDate;
      }

      const nextDrag = { ...drag, previewStartDate, previewEndDate };
      dragRef.current = nextDrag;
      setDragState(nextDrag);
    };

    const handlePointerUp = async () => {
      cancelLongPress();
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
        const now = new Date().toISOString();
        await taskRepository.update(drag.taskId, {
          startDate: drag.previewStartDate,
          dueDate: drag.previewEndDate,
          updatedAt: now,
        });

        // Cascade date changes to downstream dependents
        const cascadeUpdates = cascadeSchedule(
          ganttTasks,
          drag.taskId,
          drag.previewStartDate,
          drag.previewEndDate,
        );
        await Promise.all(
          Array.from(cascadeUpdates.entries()).map(([taskId, dates]) =>
            taskRepository.update(taskId, {
              startDate: dates.startDate,
              dueDate: dates.endDate,
              updatedAt: now,
            }),
          ),
        );

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
    cancelLongPress,
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
