import type { Contractor, Task } from "../domain/types.js";

export type ResourceHistogramEntry = {
  date: string;
  workerCount: number;
  taskIds: string[];
};

export type Bottleneck = {
  date: string;
  workerCount: number;
  maxWorkers: number;
  overflowTaskIds: string[];
};

export type ParallelGroup = {
  taskIds: string[];
  reason: string;
};

export type LevelingResult = {
  tasks: Task[];
  adjustments: Array<{
    taskId: string;
    originalStart: string;
    newStart: string;
    newEnd: string;
  }>;
};

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00Z");
  const db = new Date(b + "T12:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function getTaskEndDate(task: Task): string | undefined {
  return task.dueDate ?? task.startDate;
}

function getTaskDuration(task: Task): number {
  if (!task.startDate || !getTaskEndDate(task)) return 1;
  return Math.max(1, daysBetween(task.startDate, getTaskEndDate(task)!) + 1);
}

/**
 * Calculate a daily resource histogram showing worker count per day.
 */
export function calculateResourceHistogram(
  tasks: Task[],
  _contractors: Contractor[],
): ResourceHistogramEntry[] {
  const dailyMap = new Map<string, { workerCount: number; taskIds: string[] }>();

  for (const task of tasks) {
    if (!task.startDate || !getTaskEndDate(task)) continue;
    const dates = dateRange(task.startDate, getTaskEndDate(task)!);
    for (const d of dates) {
      const entry = dailyMap.get(d) ?? { workerCount: 0, taskIds: [] };
      entry.workerCount += 1;
      entry.taskIds.push(task.id);
      dailyMap.set(d, entry);
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, entry]) => ({
      date,
      workerCount: entry.workerCount,
      taskIds: entry.taskIds,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Identify bottleneck days where worker demand exceeds maxWorkersPerDay.
 */
export function identifyBottlenecks(
  tasks: Task[],
  _contractors: Contractor[],
  maxWorkersPerDay = 5,
): Bottleneck[] {
  const histogram = calculateResourceHistogram(tasks, _contractors);
  return histogram
    .filter((entry) => entry.workerCount > maxWorkersPerDay)
    .map((entry) => ({
      date: entry.date,
      workerCount: entry.workerCount,
      maxWorkers: maxWorkersPerDay,
      overflowTaskIds: entry.taskIds.slice(maxWorkersPerDay),
    }));
}

/**
 * Find tasks that can run in parallel (no dependency relationship between them).
 */
export function suggestParallelTasks(tasks: Task[]): ParallelGroup[] {
  const groups: ParallelGroup[] = [];
  const depSet = new Map<string, Set<string>>();

  // Build full dependency graph (both directions)
  for (const task of tasks) {
    if (!depSet.has(task.id)) depSet.set(task.id, new Set());
    for (const dep of task.dependencies) {
      depSet.get(task.id)!.add(dep);
      if (!depSet.has(dep)) depSet.set(dep, new Set());
      depSet.get(dep)!.add(task.id);
    }
  }

  const visited = new Set<string>();
  const schedulable = tasks.filter(
    (t) => t.status !== "done" && t.startDate,
  );

  for (let i = 0; i < schedulable.length; i++) {
    const taskA = schedulable[i];
    if (visited.has(taskA.id)) continue;
    const parallel: string[] = [taskA.id];

    for (let j = i + 1; j < schedulable.length; j++) {
      const taskB = schedulable[j];
      if (visited.has(taskB.id)) continue;

      const aDepOnB = depSet.get(taskA.id)?.has(taskB.id) ?? false;
      const bDepOnA = depSet.get(taskB.id)?.has(taskA.id) ?? false;

      if (!aDepOnB && !bDepOnA) {
        parallel.push(taskB.id);
      }
    }

    if (parallel.length > 1) {
      groups.push({
        taskIds: parallel,
        reason: "No dependency relationship",
      });
      for (const id of parallel) visited.add(id);
    }
  }

  return groups;
}

/**
 * Reorder tasks using topological sort to minimize total duration.
 * Tasks with no dependencies come first; then ordered by dependency chain.
 */
export function optimizeSequence(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const task of tasks) {
    if (!inDegree.has(task.id)) inDegree.set(task.id, 0);
    if (!adjList.has(task.id)) adjList.set(task.id, []);
    for (const dep of task.dependencies) {
      if (!adjList.has(dep)) adjList.set(dep, []);
      adjList.get(dep)!.push(task.id);
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }
  // Sort initial queue by start date for determinism
  queue.sort((a, b) => {
    const ta = taskMap.get(a);
    const tb = taskMap.get(b);
    return (ta?.startDate ?? "").localeCompare(tb?.startDate ?? "");
  });

  const result: Task[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = taskMap.get(id);
    if (task) result.push(task);

    for (const neighbor of adjList.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Append any remaining tasks (cycles)
  for (const task of tasks) {
    if (!result.find((r) => r.id === task.id)) {
      result.push(task);
    }
  }

  return result;
}

/**
 * Redistribute tasks to avoid resource peaks by shifting tasks
 * that exceed the maxWorkersPerDay limit to later dates.
 */
export function levelResources(
  tasks: Task[],
  _contractors: Contractor[],
  maxWorkersPerDay = 5,
): LevelingResult {
  const adjustments: LevelingResult["adjustments"] = [];
  const leveled = tasks.map((t) => ({ ...t }));

  // Sort by start date, then by dependency count (more deps = later)
  const sortedIndices = leveled
    .map((_, i) => i)
    .filter((i) => leveled[i].startDate && getTaskEndDate(leveled[i]))
    .sort((a, b) => {
      const sa = leveled[a].startDate!;
      const sb = leveled[b].startDate!;
      if (sa !== sb) return sa.localeCompare(sb);
      return leveled[b].dependencies.length - leveled[a].dependencies.length;
    });

  // Iteratively check and shift tasks
  for (let pass = 0; pass < 10; pass++) {
    const histogram = new Map<string, string[]>();
    for (const idx of sortedIndices) {
      const task = leveled[idx];
      if (!task.startDate || !getTaskEndDate(task)) continue;
      const dates = dateRange(task.startDate, getTaskEndDate(task)!);
      for (const d of dates) {
        const ids = histogram.get(d) ?? [];
        ids.push(task.id);
        histogram.set(d, ids);
      }
    }

    let shifted = false;
    for (const [date, taskIds] of histogram.entries()) {
      if (taskIds.length <= maxWorkersPerDay) continue;

      // Shift overflow tasks (last ones get shifted)
      const overflow = taskIds.slice(maxWorkersPerDay);
      for (const taskId of overflow) {
        const idx = leveled.findIndex((t) => t.id === taskId);
        if (idx === -1) continue;
        const task = leveled[idx];
        if (!task.startDate || !getTaskEndDate(task)) continue;

        const originalStart = task.startDate;
        const duration = getTaskDuration(task);
        const newStart = addDays(date, 1);
        const newEnd = addDays(newStart, duration - 1);

        leveled[idx] = { ...task, startDate: newStart, dueDate: newEnd };
        adjustments.push({
          taskId,
          originalStart,
          newStart,
          newEnd,
        });
        shifted = true;
      }
    }

    if (!shifted) break;
  }

  return { tasks: leveled, adjustments };
}
