import type { Task, TaskStatus } from "../../domain/types.js";

export type GanttTask = Task & {
  projectName: string;
  startDate: string;
  endDate: string;
  /** True if task had no dueDate and dates were auto-assigned */
  isDateEstimated: boolean;
  /** True if task is a milestone (0-1 day duration) */
  isMilestone: boolean;
  /** Whether the project includes weekends in schedule */
  projectIncludesWeekends: boolean;
  /** Contractor name, if any */
  contractorName?: string;
};

/** A group of tasks under a project/phase heading */
export type PhaseGroup = {
  projectId: string;
  projectName: string;
  tasks: GanttTask[];
  collapsed: boolean;
};

export type DragState = {
  taskId: string;
  type: "move" | "resize";
  startX: number;
  originalStartDate: string;
  originalEndDate: string;
  previewStartDate: string;
  previewEndDate: string;
};

export type ConnectState = {
  fromTaskId: string;
};

export type QuickAddState = {
  projectId: string;
  projectName: string;
  name: string;
  startDate: string;
  dueDate: string;
  contractorId: string;
  status: TaskStatus;
  submitting: boolean;
  selectedCategory: string;
};

export type TaskDetailState = {
  task: GanttTask;
  editName: string;
  editStartDate: string;
  editDueDate: string;
  editAssigneeId: string;
  editContractorId: string;
  editProgress: number;
  editStatus: TaskStatus;
  editMaterials: string;
  editLeadTimeDays: string;
  saving: boolean;
};

export type ChartLayout = {
  chartStart: string;
  chartEnd: string;
  totalDays: number;
  isCapped: boolean;
  dates: string[];
  dateInfo: Array<{ date: string; isToday: boolean; isWeekend: boolean }>;
  highlightedDates: Array<{ date: string; isToday: boolean; isWeekend: boolean }>;
  todayOffset: number;
  /** Effective pixel width per day (changes with zoom level) */
  dayWidth: number;
};

export type WorkItem = {
  name: string;
  defaultDays: number;
};

export type WorkCategory = {
  label: string;
  items: WorkItem[];
};
