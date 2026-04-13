/**
 * AI Schedule Generator — KENCOPA蒸留
 * Auto-generates construction project schedules from design specs,
 * using historical pace data (歩掛) to predict task durations.
 */

import { escapeHtml } from "./utils/escape-html.js";
import { csvEscape } from "./utils/csv-escape.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkCategory =
  | "demolition"
  | "framing"
  | "mep_rough"
  | "mep_finish"
  | "interior_rough"
  | "interior_finish"
  | "exterior"
  | "waterproof"
  | "painting"
  | "cleaning"
  | "other";

export type PaceData = {
  category: WorkCategory;
  taskName: string;
  /** Area (㎡) or unit count processed per day */
  unitArea: number;
  daysPerUnit: number;
  crewSize: number;
  note?: string;
};

export type ScheduleConstraint = {
  type: "must_start_after" | "must_finish_before" | "same_day" | "sequential";
  taskA: string;
  taskB?: string;
  date?: Date;
};

export type GeneratedTask = {
  id: string;
  name: string;
  category: WorkCategory;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  dependencies: string[];
  crewSize: number;
  area?: number;
  floor?: number;
  room?: string;
};

export type GeneratedSchedule = {
  projectId: string;
  projectName: string;
  tasks: GeneratedTask[];
  totalDays: number;
  startDate: Date;
  endDate: Date;
  criticalPath: string[];
  generatedAt: Date;
};

export type ProjectSpec = {
  projectName: string;
  totalArea: number;
  floors: number;
  rooms?: { name: string; area: number; floor: number }[];
  projectType: "new_build" | "renovation" | "interior_only" | "exterior_only";
  startDate: Date;
  constraints?: ScheduleConstraint[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addWorkDays(date: Date, days: number, holidays: Date[] = []): Date {
  const holidaySet = new Set(holidays.map((d) => toDateKey(d)));
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(toDateKey(result))) {
      remaining--;
    }
  }
  return result;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function cloneDate(d: Date): Date {
  return new Date(d);
}

function formatDateJP(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function uniqueId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

// ─── Default Pace Data ────────────────────────────────────────────────────────

/**
 * Returns built-in pace data for interior construction projects.
 * Rates are based on typical Tokyo interior renovation standards.
 */
export function getDefaultPaceData(): PaceData[] {
  return [
    {
      category: "demolition",
      taskName: "解体",
      unitArea: 20,
      daysPerUnit: 1,
      crewSize: 2,
      note: "既存内装の解体・撤去",
    },
    {
      category: "framing",
      taskName: "LGS下地",
      unitArea: 15,
      daysPerUnit: 1,
      crewSize: 2,
      note: "軽量鉄骨下地組み",
    },
    {
      category: "interior_rough",
      taskName: "ボード張り",
      unitArea: 20,
      daysPerUnit: 1,
      crewSize: 2,
      note: "石膏ボード張り",
    },
    {
      category: "mep_rough",
      taskName: "電気粗配線",
      unitArea: 30,
      daysPerUnit: 1,
      crewSize: 1,
      note: "電気幹線・分岐配線",
    },
    {
      category: "mep_rough",
      taskName: "設備粗配管",
      unitArea: 25,
      daysPerUnit: 1,
      crewSize: 1,
      note: "給排水・衛生配管",
    },
    {
      category: "mep_rough",
      taskName: "空調ダクト",
      unitArea: 35,
      daysPerUnit: 1,
      crewSize: 2,
      note: "空調ダクト・換気配管",
    },
    {
      category: "interior_finish",
      taskName: "クロス貼り",
      unitArea: 25,
      daysPerUnit: 1,
      crewSize: 1,
      note: "壁・天井クロス仕上げ",
    },
    {
      category: "painting",
      taskName: "塗装",
      unitArea: 30,
      daysPerUnit: 1,
      crewSize: 1,
      note: "EP塗装・AEP塗装",
    },
    {
      category: "interior_finish",
      taskName: "床材施工",
      unitArea: 20,
      daysPerUnit: 1,
      crewSize: 2,
      note: "フローリング・タイルカーペット",
    },
    {
      category: "interior_finish",
      taskName: "建具取付",
      unitArea: 3,
      daysPerUnit: 1,
      crewSize: 1,
      note: "ドア・引き戸取付（枚数/日）",
    },
    {
      category: "mep_finish",
      taskName: "器具付け",
      unitArea: 20,
      daysPerUnit: 1,
      crewSize: 1,
      note: "照明・スイッチ・コンセント器具取付（箇所/日）",
    },
    {
      category: "cleaning",
      taskName: "美装",
      unitArea: 40,
      daysPerUnit: 1,
      crewSize: 2,
      note: "竣工清掃",
    },
    {
      category: "waterproof",
      taskName: "防水工事",
      unitArea: 15,
      daysPerUnit: 1,
      crewSize: 1,
      note: "ウレタン防水・シート防水",
    },
    {
      category: "exterior",
      taskName: "外壁工事",
      unitArea: 10,
      daysPerUnit: 1,
      crewSize: 2,
      note: "ALC・サイディング・タイル",
    },
    {
      category: "interior_rough",
      taskName: "天井下地",
      unitArea: 20,
      daysPerUnit: 1,
      crewSize: 2,
      note: "軽鉄天井下地組み",
    },
    {
      category: "mep_finish",
      taskName: "空調器具取付",
      unitArea: 5,
      daysPerUnit: 1,
      crewSize: 2,
      note: "エアコン・換気扇取付（台/日）",
    },
    {
      category: "interior_finish",
      taskName: "タイル工事",
      unitArea: 8,
      daysPerUnit: 1,
      crewSize: 1,
      note: "内装タイル張り",
    },
  ];
}

// ─── Standard Dependencies ────────────────────────────────────────────────────

/**
 * Standard dependency rules for interior construction workflow.
 * Returns pairs of [prerequisite task name, dependent task name].
 */
function getStandardDependencyRules(): Array<[string, string]> {
  return [
    ["解体", "LGS下地"],
    ["解体", "天井下地"],
    ["解体", "電気粗配線"],
    ["解体", "設備粗配管"],
    ["解体", "空調ダクト"],
    ["解体", "防水工事"],
    ["LGS下地", "ボード張り"],
    ["天井下地", "ボード張り"],
    ["ボード張り", "クロス貼り"],
    ["ボード張り", "塗装"],
    ["ボード張り", "タイル工事"],
    ["電気粗配線", "器具付け"],
    ["設備粗配管", "タイル工事"],
    ["空調ダクト", "空調器具取付"],
    ["クロス貼り", "建具取付"],
    ["塗装", "床材施工"],
    ["クロス貼り", "床材施工"],
    ["建具取付", "美装"],
    ["床材施工", "美装"],
    ["器具付け", "美装"],
    ["空調器具取付", "美装"],
    ["タイル工事", "美装"],
  ];
}

// ─── Duration Calculation ─────────────────────────────────────────────────────

function calculateDuration(pace: PaceData, area: number): number {
  if (area <= 0) return 1;
  return Math.max(1, Math.ceil((area / pace.unitArea) * pace.daysPerUnit));
}

// ─── Schedule Generation ──────────────────────────────────────────────────────

/**
 * Auto-generates a full project schedule from the given spec.
 * Applies standard construction dependencies, custom constraints,
 * date calculation (work days), and critical path identification.
 */
export function generateSchedule(
  spec: ProjectSpec,
  paceData?: PaceData[],
  constraints?: ScheduleConstraint[],
): GeneratedSchedule {
  const pace = paceData ?? getDefaultPaceData();
  const allConstraints = [
    ...(spec.constraints ?? []),
    ...(constraints ?? []),
  ];

  const area = spec.totalArea > 0 ? spec.totalArea : 1;

  // Filter pace data to relevant tasks based on project type
  const relevantPace = pace.filter((p) => {
    if (spec.projectType === "exterior_only") {
      return p.category === "exterior" || p.category === "waterproof" || p.category === "painting";
    }
    if (spec.projectType === "interior_only") {
      return p.category !== "exterior";
    }
    return true;
  });

  // Build task list with durations
  const tasks: GeneratedTask[] = relevantPace.map((p, i) => {
    const duration = calculateDuration(p, area);
    const id = uniqueId(p.taskName, i);
    return {
      id,
      name: p.taskName,
      category: p.category,
      startDate: cloneDate(spec.startDate),
      endDate: cloneDate(spec.startDate),
      durationDays: duration,
      dependencies: [],
      crewSize: p.crewSize,
      area,
    };
  });

  const taskByName = new Map(tasks.map((t) => [t.name, t]));

  // Apply standard dependency rules
  const depRules = getStandardDependencyRules();
  for (const [prereqName, depName] of depRules) {
    const prereq = taskByName.get(prereqName);
    const dep = taskByName.get(depName);
    if (prereq && dep && !dep.dependencies.includes(prereq.id)) {
      dep.dependencies.push(prereq.id);
    }
  }

  // Apply custom constraints as additional dependencies
  for (const constraint of allConstraints) {
    const taskA = taskByName.get(constraint.taskA);
    if (!taskA) continue;

    if (constraint.type === "must_start_after" && constraint.taskB) {
      const taskB = taskByName.get(constraint.taskB);
      if (taskB && !taskB.dependencies.includes(taskA.id)) {
        taskB.dependencies.push(taskA.id);
      }
    } else if (constraint.type === "sequential" && constraint.taskB) {
      const taskB = taskByName.get(constraint.taskB);
      if (taskB && !taskB.dependencies.includes(taskA.id)) {
        taskB.dependencies.push(taskA.id);
      }
    } else if (constraint.type === "must_finish_before" && constraint.date) {
      // Enforced during date calculation (we will not push past it)
      // Stored as constraint, no structural change needed here
    } else if (constraint.type === "same_day" && constraint.taskB) {
      // Will sync dates after topological sort
    }
  }

  // Topological sort to determine schedule order
  const sorted = topologicalSort(tasks);

  // Calculate start/end dates based on dependencies
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const task of sorted) {
    let earliestStart = cloneDate(spec.startDate);

    for (const depId of task.dependencies) {
      const dep = taskById.get(depId);
      if (dep) {
        const depEnd = cloneDate(dep.endDate);
        depEnd.setDate(depEnd.getDate() + 1); // start day after dependency ends
        if (depEnd > earliestStart) {
          earliestStart = depEnd;
        }
      }
    }

    task.startDate = earliestStart;
    task.endDate = addWorkDays(earliestStart, task.durationDays - 1);
  }

  // Apply same_day constraints (align start dates)
  for (const constraint of allConstraints) {
    if (constraint.type === "same_day" && constraint.taskB) {
      const taskA = taskByName.get(constraint.taskA);
      const taskB = taskByName.get(constraint.taskB);
      if (taskA && taskB) {
        const laterStart = taskA.startDate > taskB.startDate ? taskA.startDate : taskB.startDate;
        taskA.startDate = cloneDate(laterStart);
        taskA.endDate = addWorkDays(taskA.startDate, taskA.durationDays - 1);
        taskB.startDate = cloneDate(laterStart);
        taskB.endDate = addWorkDays(taskB.startDate, taskB.durationDays - 1);
      }
    }
  }

  const projectStart = cloneDate(spec.startDate);
  const projectEnd = tasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    cloneDate(spec.startDate),
  );

  const totalDays = calendarDaysBetween(projectStart, projectEnd) + 1;
  const criticalPath = calculateCriticalPath(tasks);

  return {
    projectId: `proj-${Date.now()}`,
    projectName: spec.projectName,
    tasks,
    totalDays,
    startDate: projectStart,
    endDate: projectEnd,
    criticalPath,
    generatedAt: new Date(),
  };
}

// ─── Topological Sort ─────────────────────────────────────────────────────────

function topologicalSort(tasks: GeneratedTask[]): GeneratedTask[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: GeneratedTask[] = [];

  function visit(task: GeneratedTask): void {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    for (const depId of task.dependencies) {
      const dep = taskById.get(depId);
      if (dep) visit(dep);
    }
    result.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return result;
}

// ─── Critical Path ────────────────────────────────────────────────────────────

/**
 * Identifies the critical path — the longest dependency chain by total duration.
 * Returns an ordered array of task IDs forming the critical path.
 */
export function calculateCriticalPath(tasks: GeneratedTask[]): string[] {
  if (tasks.length === 0) return [];

  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Compute longest path (in work days) to complete each task
  const longestPath = new Map<string, number>();
  const predecessor = new Map<string, string | null>();

  const sorted = topologicalSort(tasks);

  for (const task of sorted) {
    let maxDepPath = 0;
    let bestDep: string | null = null;

    for (const depId of task.dependencies) {
      const depPath = longestPath.get(depId) ?? 0;
      const dep = taskById.get(depId);
      if (dep && depPath > maxDepPath) {
        maxDepPath = depPath;
        bestDep = depId;
      }
    }

    longestPath.set(task.id, maxDepPath + task.durationDays);
    predecessor.set(task.id, bestDep);
  }

  // Find the task with the maximum longest path
  let maxPath = 0;
  let endTaskId = "";
  for (const [id, path] of longestPath) {
    if (path > maxPath) {
      maxPath = path;
      endTaskId = id;
    }
  }

  if (!endTaskId) return [];

  // Trace back to build critical path
  const path: string[] = [];
  let current: string | null = endTaskId;
  while (current !== null) {
    path.unshift(current);
    current = predecessor.get(current) ?? null;
  }

  return path;
}

// ─── Holiday Adjustment ───────────────────────────────────────────────────────

/**
 * Adjusts all task dates in a schedule to skip weekends and specified holidays.
 * Recalculates end dates based on work days only.
 */
export function adjustScheduleForHolidays(
  schedule: GeneratedSchedule,
  holidays: Date[],
): GeneratedSchedule {
  const holidaySet = new Set(holidays.map((d) => toDateKey(d)));

  function isWorkDay(date: Date): boolean {
    const dow = date.getDay();
    return dow !== 0 && dow !== 6 && !holidaySet.has(toDateKey(date));
  }

  function nextWorkDay(date: Date): Date {
    const d = cloneDate(date);
    while (!isWorkDay(d)) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function addWorkDaysWithHolidays(start: Date, workDays: number): Date {
    if (workDays <= 0) return cloneDate(start);
    const d = cloneDate(start);
    let added = 0;
    while (added < workDays) {
      d.setDate(d.getDate() + 1);
      if (isWorkDay(d)) added++;
    }
    return d;
  }

  // Re-sort tasks by dependency order and recalculate dates
  const sorted = topologicalSort(schedule.tasks);
  const taskById = new Map(schedule.tasks.map((t) => [t.id, t]));
  const updatedById = new Map<string, GeneratedTask>();

  for (const task of sorted) {
    let earliestStart = nextWorkDay(schedule.startDate);

    for (const depId of task.dependencies) {
      const dep = updatedById.get(depId) ?? taskById.get(depId);
      if (dep) {
        const depEnd = cloneDate(dep.endDate);
        depEnd.setDate(depEnd.getDate() + 1);
        const nextWork = nextWorkDay(depEnd);
        if (nextWork > earliestStart) {
          earliestStart = nextWork;
        }
      }
    }

    const startDate = nextWorkDay(earliestStart);
    const endDate = addWorkDaysWithHolidays(startDate, task.durationDays - 1);

    const updated: GeneratedTask = {
      ...task,
      startDate,
      endDate,
    };
    updatedById.set(task.id, updated);
  }

  const adjustedTasks = schedule.tasks.map((t) => updatedById.get(t.id) ?? t);

  const newEnd = adjustedTasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    cloneDate(schedule.startDate),
  );

  const totalDays = calendarDaysBetween(schedule.startDate, newEnd) + 1;
  const criticalPath = calculateCriticalPath(adjustedTasks);

  return {
    ...schedule,
    tasks: adjustedTasks,
    totalDays,
    endDate: newEnd,
    criticalPath,
  };
}

// ─── Schedule Compression ─────────────────────────────────────────────────────

/**
 * Attempts to compress the schedule to fit within targetDays.
 * Strategy: parallelize non-dependent tasks and proportionally increase crew sizes.
 */
export function compressSchedule(
  schedule: GeneratedSchedule,
  targetDays: number,
): GeneratedSchedule {
  if (schedule.totalDays <= targetDays || targetDays <= 0) {
    return schedule;
  }

  const compressionRatio = schedule.totalDays / targetDays;

  // Reduce durations (min 1 day) and increase crew proportionally
  const compressedTasks: GeneratedTask[] = schedule.tasks.map((task) => {
    const newDuration = Math.max(1, Math.round(task.durationDays / compressionRatio));
    const newCrew = Math.ceil(task.crewSize * compressionRatio);
    return {
      ...task,
      durationDays: newDuration,
      crewSize: newCrew,
    };
  });

  // Recalculate dates with compressed durations
  const sorted = topologicalSort(compressedTasks);
  const taskById = new Map(compressedTasks.map((t) => [t.id, t]));

  for (const task of sorted) {
    let earliestStart = cloneDate(schedule.startDate);

    for (const depId of task.dependencies) {
      const dep = taskById.get(depId);
      if (dep) {
        const depEnd = cloneDate(dep.endDate);
        depEnd.setDate(depEnd.getDate() + 1);
        if (depEnd > earliestStart) earliestStart = depEnd;
      }
    }

    task.startDate = earliestStart;
    task.endDate = addWorkDays(earliestStart, task.durationDays - 1);
  }

  const newEnd = compressedTasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    cloneDate(schedule.startDate),
  );

  const totalDays = calendarDaysBetween(schedule.startDate, newEnd) + 1;
  const criticalPath = calculateCriticalPath(compressedTasks);

  return {
    ...schedule,
    tasks: compressedTasks,
    totalDays,
    endDate: newEnd,
    criticalPath,
  };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export type ScheduleSummary = {
  totalDays: number;
  totalTasks: number;
  tasksByCategory: Record<WorkCategory, number>;
  peakCrew: number;
  criticalPathLength: number;
  criticalPathTaskNames: string[];
};

/**
 * Returns summary statistics for a generated schedule.
 */
export function getScheduleSummary(schedule: GeneratedSchedule): ScheduleSummary {
  const tasksByCategory = {} as Record<WorkCategory, number>;

  for (const task of schedule.tasks) {
    tasksByCategory[task.category] = (tasksByCategory[task.category] ?? 0) + 1;
  }

  // Calculate peak crew: find the day with the most concurrent crew
  const crewByDay = new Map<string, number>();
  for (const task of schedule.tasks) {
    const d = cloneDate(task.startDate);
    while (d <= task.endDate) {
      const key = toDateKey(d);
      crewByDay.set(key, (crewByDay.get(key) ?? 0) + task.crewSize);
      d.setDate(d.getDate() + 1);
    }
  }

  const peakCrew = crewByDay.size > 0 ? Math.max(...crewByDay.values()) : 0;

  const taskById = new Map(schedule.tasks.map((t) => [t.id, t]));
  const criticalPathTaskNames = schedule.criticalPath
    .map((id) => taskById.get(id)?.name ?? id);

  return {
    totalDays: schedule.totalDays,
    totalTasks: schedule.tasks.length,
    tasksByCategory,
    peakCrew,
    criticalPathLength: schedule.criticalPath.length,
    criticalPathTaskNames,
  };
}

// ─── HTML Gantt Chart ─────────────────────────────────────────────────────────

/**
 * Generates a printable HTML Gantt chart with task bars,
 * critical path highlighted in red, and a date header.
 */
export function buildScheduleGanttHtml(schedule: GeneratedSchedule): string {
  const criticalSet = new Set(schedule.criticalPath);
  const projectStartMs = schedule.startDate.getTime();
  const totalDays = schedule.totalDays;

  // Cap visible days to prevent enormous charts
  const visibleDays = Math.min(totalDays, 120);
  const dayWidth = 18;
  const labelWidth = 160;
  const rowHeight = 28;
  const headerHeight = 36;

  const chartWidth = labelWidth + visibleDays * dayWidth;
  const chartHeight = headerHeight + schedule.tasks.length * rowHeight;

  // Build day headers
  const dayHeaders: string[] = [];
  for (let i = 0; i < visibleDays; i++) {
    const d = new Date(projectStartMs + i * 86400000);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const label = escapeHtml(String(d.getDate()));
    const bg = isWeekend ? "#f1f5f9" : "#ffffff";
    dayHeaders.push(
      `<rect x="${labelWidth + i * dayWidth}" y="0" width="${dayWidth}" height="${headerHeight}" fill="${bg}" stroke="#e2e8f0" stroke-width="0.5"/>` +
        `<text x="${labelWidth + i * dayWidth + dayWidth / 2}" y="${headerHeight - 10}" text-anchor="middle" font-size="9" fill="#475569">${label}</text>`,
    );
  }

  // Build task rows
  const taskRows: string[] = [];
  const sorted = [...schedule.tasks].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  sorted.forEach((task, rowIndex) => {
    const y = headerHeight + rowIndex * rowHeight;
    const isCritical = criticalSet.has(task.id);
    const barColor = isCritical ? "#dc2626" : "#2563eb";
    const barColorLight = isCritical ? "#fecaca" : "#bfdbfe";

    const startOffset = Math.max(
      0,
      Math.round((task.startDate.getTime() - projectStartMs) / 86400000),
    );
    const endOffset = Math.min(
      visibleDays,
      Math.round((task.endDate.getTime() - projectStartMs) / 86400000) + 1,
    );
    const barX = labelWidth + startOffset * dayWidth;
    const barWidth = Math.max(dayWidth, (endOffset - startOffset) * dayWidth);
    const barY = y + 4;
    const barHeight = rowHeight - 8;

    // Row background
    const rowBg = rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff";
    taskRows.push(`<rect x="0" y="${y}" width="${chartWidth}" height="${rowHeight}" fill="${rowBg}"/>`);

    // Label
    taskRows.push(
      `<text x="8" y="${y + rowHeight / 2 + 4}" font-size="11" fill="#1e293b">${escapeHtml(task.name)}</text>`,
    );

    // Bar background
    taskRows.push(
      `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="${barColorLight}" stroke="${barColor}" stroke-width="1"/>`,
    );

    // Bar label (days)
    if (barWidth > 30) {
      taskRows.push(
        `<text x="${barX + barWidth / 2}" y="${barY + barHeight / 2 + 4}" text-anchor="middle" font-size="9" fill="${barColor}">${escapeHtml(String(task.durationDays))}d</text>`,
      );
    }
  });

  const title = escapeHtml(schedule.projectName);
  const generatedAt = escapeHtml(formatDateJP(schedule.generatedAt));
  const svgContent = [...dayHeaders, ...taskRows].join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${title} — 工程表</title>
<style>
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 16px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 12px; }
  .legend { font-size: 11px; margin-bottom: 8px; }
  .legend span { display: inline-flex; align-items: center; gap: 4px; margin-right: 16px; }
  .dot-blue { width: 10px; height: 10px; background: #2563eb; border-radius: 2px; display: inline-block; }
  .dot-red { width: 10px; height: 10px; background: #dc2626; border-radius: 2px; display: inline-block; }
  svg { border: 1px solid #e2e8f0; border-radius: 4px; overflow: visible; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${title} — 工程表</h1>
<div class="meta">生成日時: ${generatedAt} ／ 総工期: ${escapeHtml(String(schedule.totalDays))}日 ／ タスク数: ${escapeHtml(String(schedule.tasks.length))}</div>
<div class="legend">
  <span><i class="dot-blue"></i>通常工程</span>
  <span><i class="dot-red"></i>クリティカルパス</span>
</div>
<svg width="${chartWidth}" height="${chartHeight}" xmlns="http://www.w3.org/2000/svg">
${svgContent}
</svg>
</body>
</html>`;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Exports the schedule to CSV format.
 * Columns: タスク名, カテゴリ, 開始日, 終了日, 工期(日), 依存タスク, クルー数
 */
export function exportScheduleCSV(schedule: GeneratedSchedule): string {
  const taskById = new Map(schedule.tasks.map((t) => [t.id, t]));
  const header = "タスク名,カテゴリ,開始日,終了日,工期(日),依存タスク,クルー数";

  const rows = schedule.tasks.map((task) => {
    const deps = task.dependencies
      .map((id) => taskById.get(id)?.name ?? id)
      .join("|");
    const fields = [
      csvEscape(task.name),
      csvEscape(task.category),
      formatDateJP(task.startDate),
      formatDateJP(task.endDate),
      String(task.durationDays),
      csvEscape(deps),
      String(task.crewSize),
    ];
    return fields.join(",");
  });

  return [header, ...rows].join("\n");
}


// ─── Pace Learning ────────────────────────────────────────────────────────────

/**
 * Updates pace data from actual performance using an exponential moving average.
 * alpha = 0.3 (weights recent data at 30%, history at 70%).
 */
export function updatePaceFromActual(
  paceData: PaceData[],
  taskName: string,
  actualDays: number,
  actualArea: number,
): PaceData[] {
  const alpha = 0.3;

  return paceData.map((p) => {
    if (p.taskName !== taskName) return p;

    const actualDaysPerUnit = actualArea > 0 ? actualDays / (actualArea / p.unitArea) : actualDays;
    const updatedDaysPerUnit = alpha * actualDaysPerUnit + (1 - alpha) * p.daysPerUnit;

    return {
      ...p,
      daysPerUnit: Math.max(0.1, Number(updatedDaysPerUnit.toFixed(3))),
      note: p.note
        ? `${p.note}（実績反映: ${actualDays}日/${actualArea}㎡）`
        : `実績反映: ${actualDays}日/${actualArea}㎡`,
    };
  });
}
