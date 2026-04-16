/**
 * Schedule Risk Forecaster — nPlan蒸留
 * Probabilistic schedule forecasting using log-normal duration distributions
 * and Monte Carlo simulation over dependency graphs.
 */

import type { GeneratedSchedule, GeneratedTask, PaceData } from "./ai-schedule-generator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DurationDistribution {
  p50: number;
  p80: number;
  p95: number;
  mean: number;
  stdDev: number;
  sampleSize: number;
}

export interface ScheduleForecast {
  taskForecasts: Map<string, DurationDistribution>;
  projectEndP50: Date;
  projectEndP80: Date;
  projectEndP95: Date;
  iterations: number;
}

export interface TaskPath {
  taskIds: string[];
  probability: number;
  expectedDelay: number;
  explanation: string;
}

// ─── Seeded PRNG (Mulberry32) — reproducible Monte Carlo runs ────────────────

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Box-Muller normal sample ─────────────────────────────────────────────────

function sampleNormal(rng: Rng = Math.random): number {
  // Box-Muller transform
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-300)) * Math.cos(2 * Math.PI * u2);
}

// ─── Log-normal fitting ───────────────────────────────────────────────────────

function fitLogNormal(values: number[]): { mu: number; sigma: number } {
  const logs = values.map((v) => Math.log(Math.max(v, 0.1)));
  const mu = logs.reduce((s, v) => s + v, 0) / logs.length;
  const variance =
    logs.reduce((s, v) => s + (v - mu) ** 2, 0) / logs.length;
  return { mu, sigma: Math.sqrt(variance) };
}

function lognormalQuantile(mu: number, sigma: number, p: number): number {
  // Rational approximation of inverse normal CDF (Beasley-Springer-Moro)
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(p <= 0.5 ? p : 1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z0 = t - num / den;
  const z = p <= 0.5 ? -z0 : z0;
  return Math.exp(mu + sigma * z);
}

// ─── Dependency-aware end-date calculation ────────────────────────────────────

function computeEndDates(
  tasks: GeneratedTask[],
  durationOverrides: Map<string, number>,
  projectStart: Date,
): Map<string, Date> {
  // Build lookup
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const endDates = new Map<string, Date>();

  // Topological sort (simple Kahn's)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // depId -> tasks that depend on it
  for (const t of tasks) {
    inDegree.set(t.id, t.dependencies.length);
    for (const dep of t.dependencies) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(t.id);
    }
  }

  const queue: string[] = [];
  for (const t of tasks) {
    if (t.dependencies.length === 0) queue.push(t.id);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = taskById.get(id)!;
    const duration = durationOverrides.get(id) ?? task.durationDays;

    // Earliest start: day after all deps end
    let start = new Date(projectStart);
    for (const depId of task.dependencies) {
      const depEnd = endDates.get(depId);
      if (depEnd) {
        const next = new Date(depEnd);
        next.setDate(next.getDate() + 1);
        if (next > start) start = next;
      }
    }

    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(1, Math.round(duration)) - 1);
    endDates.set(id, end);

    for (const depId of dependents.get(id) ?? []) {
      const deg = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, deg);
      if (deg === 0) queue.push(depId);
    }
  }

  return endDates;
}

// ─── (1) forecastTaskDuration ─────────────────────────────────────────────────

/**
 * Forecasts duration distribution for a single task using historical PaceData.
 * Matches by taskName, then fits log-normal. Falls back to ±20% std dev when
 * fewer than 3 historical samples are available.
 */
export function forecastTaskDuration(
  task: GeneratedTask,
  history: PaceData[],
): DurationDistribution {
  // Find same-category pace records and treat daysPerUnit*unitArea as a proxy duration
  const matches = history.filter(
    (p) =>
      p.category === task.category ||
      p.taskName === task.name,
  );

  // Convert PaceData records to synthetic durations using area if available
  const area = task.area ?? 1;
  const durations = matches.map((p) =>
    Math.max(1, (area / p.unitArea) * p.daysPerUnit),
  );

  if (durations.length < 3) {
    // Fallback: center on task.durationDays with 20% stdDev
    const mean = task.durationDays;
    const stdDev = task.durationDays * 0.2;
    return {
      p50: mean,
      p80: Math.round(mean + 0.842 * stdDev),
      p95: Math.round(mean + 1.645 * stdDev),
      mean,
      stdDev,
      sampleSize: durations.length,
    };
  }

  const { mu, sigma } = fitLogNormal(durations);
  const mean = Math.exp(mu + (sigma * sigma) / 2);
  const variance = (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma);
  const stdDev = Math.sqrt(variance);

  return {
    p50: Math.max(1, Math.round(lognormalQuantile(mu, sigma, 0.5))),
    p80: Math.max(1, Math.round(lognormalQuantile(mu, sigma, 0.8))),
    p95: Math.max(1, Math.round(lognormalQuantile(mu, sigma, 0.95))),
    mean,
    stdDev,
    sampleSize: durations.length,
  };
}

// ─── (2) monteCarloSchedule ───────────────────────────────────────────────────

/**
 * Runs Monte Carlo simulation over the schedule.
 * Each iteration samples task durations from their distributions and
 * propagates through the dependency graph to get a project end date.
 */
export function monteCarloSchedule(
  schedule: GeneratedSchedule,
  history: PaceData[],
  iterations = 1000,
  seed?: number,
): ScheduleForecast {
  const rng: Rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const taskForecasts = new Map<string, DurationDistribution>();
  for (const task of schedule.tasks) {
    taskForecasts.set(task.id, forecastTaskDuration(task, history));
  }

  // Collect project end timestamps across iterations
  const endTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const durationOverrides = new Map<string, number>();
    for (const task of schedule.tasks) {
      const dist = taskForecasts.get(task.id)!;
      // Sample from log-normal: exp(mu + sigma * N(0,1))
      // Derive mu/sigma from mean/stdDev
      const { mean, stdDev } = dist;
      if (stdDev === 0 || mean === 0) {
        durationOverrides.set(task.id, mean);
        continue;
      }
      const sigma2 = Math.log(1 + (stdDev / mean) ** 2);
      const mu = Math.log(mean) - sigma2 / 2;
      const sigma = Math.sqrt(sigma2);
      const sample = Math.exp(mu + sigma * sampleNormal(rng));
      durationOverrides.set(task.id, Math.max(1, sample));
    }

    const endDates = computeEndDates(
      schedule.tasks,
      durationOverrides,
      schedule.startDate,
    );

    let latestEnd = schedule.startDate;
    for (const d of endDates.values()) {
      if (d > latestEnd) latestEnd = d;
    }
    endTimes.push(latestEnd.getTime());
  }

  endTimes.sort((a, b) => a - b);

  const p50 = new Date(endTimes[Math.floor(iterations * 0.5)]);
  const p80 = new Date(endTimes[Math.floor(iterations * 0.8)]);
  const p95 = new Date(endTimes[Math.floor(iterations * 0.95)]);

  return {
    taskForecasts,
    projectEndP50: p50,
    projectEndP80: p80,
    projectEndP95: p95,
    iterations,
  };
}

// ─── (3) identifyDrivingPaths ─────────────────────────────────────────────────

/**
 * Runs Monte Carlo iterations tracking which dependency chain is critical
 * (longest path) in each iteration. Returns top-N paths sorted by probability.
 */
export function identifyDrivingPaths(
  schedule: GeneratedSchedule,
  forecast: ScheduleForecast,
  history: PaceData[],
  topN = 3,
  seed?: number,
): TaskPath[] {
  const rng: Rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const iterations = forecast.iterations;
  // key = JSON of task ID array (chain), value = {count, totalDelay}
  const pathCounts = new Map<string, { ids: string[]; count: number; totalDelay: number }>();

  const baseEndTime = schedule.endDate.getTime();

  for (let i = 0; i < iterations; i++) {
    const durationOverrides = new Map<string, number>();
    for (const task of schedule.tasks) {
      const dist = forecast.taskForecasts.get(task.id)!;
      const { mean, stdDev } = dist;
      if (stdDev === 0 || mean === 0) {
        durationOverrides.set(task.id, mean);
        continue;
      }
      const sigma2 = Math.log(1 + (stdDev / mean) ** 2);
      const mu = Math.log(mean) - sigma2 / 2;
      const sigma = Math.sqrt(sigma2);
      const sample = Math.exp(mu + sigma * sampleNormal(rng));
      durationOverrides.set(task.id, Math.max(1, sample));
    }

    const endDates = computeEndDates(
      schedule.tasks,
      durationOverrides,
      schedule.startDate,
    );

    // Find the critical task (latest end date)
    let latestEnd = schedule.startDate;
    let criticalTaskId = schedule.tasks[0]?.id ?? "";
    for (const [id, d] of endDates) {
      if (d > latestEnd) {
        latestEnd = d;
        criticalTaskId = id;
      }
    }

    // Trace back the critical chain
    const chain = traceCriticalChain(
      criticalTaskId,
      schedule.tasks,
      endDates,
    );
    const key = JSON.stringify(chain);
    const delayDays = Math.max(
      0,
      Math.round((latestEnd.getTime() - baseEndTime) / 86400000),
    );

    if (!pathCounts.has(key)) {
      pathCounts.set(key, { ids: chain, count: 0, totalDelay: 0 });
    }
    const entry = pathCounts.get(key)!;
    entry.count++;
    entry.totalDelay += delayDays;
  }

  // Sort by count descending
  const sorted = [...pathCounts.values()].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, topN);

  return top.map((entry) => ({
    taskIds: entry.ids,
    probability: entry.count / iterations,
    expectedDelay: entry.count > 0 ? entry.totalDelay / entry.count : 0,
    explanation: explainRisk(
      {
        taskIds: entry.ids,
        probability: entry.count / iterations,
        expectedDelay: entry.count > 0 ? entry.totalDelay / entry.count : 0,
        explanation: "",
      },
      schedule,
    ),
  }));
}

function traceCriticalChain(
  endTaskId: string,
  tasks: GeneratedTask[],
  endDates: Map<string, Date>,
): string[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const chain: string[] = [];
  let current: string | null = endTaskId;

  while (current !== null) {
    chain.unshift(current);
    const task = taskById.get(current);
    if (!task || task.dependencies.length === 0) break;

    // Follow the dependency that ends latest
    let latestDepEnd: Date | null = null;
    let bestDep: string | null = null;
    for (const depId of task.dependencies) {
      const depEnd = endDates.get(depId);
      if (depEnd && (latestDepEnd === null || depEnd > latestDepEnd)) {
        latestDepEnd = depEnd;
        bestDep = depId;
      }
    }
    current = bestDep;
  }

  return chain;
}

// ─── (4) explainRisk ─────────────────────────────────────────────────────────

/**
 * Generates a Japanese explanation for a driving path risk.
 */
export function explainRisk(
  path: TaskPath,
  schedule: GeneratedSchedule,
): string {
  const taskById = new Map(schedule.tasks.map((t) => [t.id, t]));
  const names = path.taskIds
    .map((id) => taskById.get(id)?.name ?? id)
    .join("→");
  const pct = Math.round(path.probability * 100);
  const delay = path.expectedDelay.toFixed(1);

  if (path.taskIds.length === 0) {
    return "クリティカルパスが特定できませんでした。";
  }

  return `${names}のパスが${pct}%の確率でクリティカル、平均${delay}日の遅延が見込まれます。`;
}
