/**
 * Timeline analysis: delay detection, completion prediction, timeline reporting.
 */

export type DelayCategory =
  | "weather"
  | "material"
  | "labor"
  | "permit"
  | "design_change"
  | "equipment"
  | "unknown";

export type DelayEntry = {
  taskName: string;
  category: DelayCategory;
  delayDays: number;
  description: string;
  date: string;
};

export type DelayCause = {
  category: DelayCategory;
  totalDays: number;
  occurrences: number;
  percentage: number;
};

export type DelayAnalysis = {
  totalDelayDays: number;
  causes: DelayCause[];
  mostFrequentCause: DelayCategory;
  largestCause: DelayCategory;
};

export type CompletionPrediction = {
  originalEndDate: string;
  predictedEndDate: string;
  slippageDays: number;
  confidence: "high" | "medium" | "low";
  progressPct: number;
};

export type TimelineReport = {
  projectName: string;
  startDate: string;
  originalEndDate: string;
  predictedEndDate: string;
  totalTasks: number;
  completedTasks: number;
  progressPct: number;
  delayAnalysis: DelayAnalysis;
  onTrack: boolean;
};

// ── Analyze delay causes ──────────────────────────────

export function analyzeDelay(delays: DelayEntry[]): DelayAnalysis {
  if (delays.length === 0) {
    return {
      totalDelayDays: 0,
      causes: [],
      mostFrequentCause: "unknown",
      largestCause: "unknown",
    };
  }

  const categoryMap = new Map<
    DelayCategory,
    { totalDays: number; count: number }
  >();

  for (const d of delays) {
    const existing = categoryMap.get(d.category) ?? {
      totalDays: 0,
      count: 0,
    };
    existing.totalDays += d.delayDays;
    existing.count += 1;
    categoryMap.set(d.category, existing);
  }

  const totalDays = delays.reduce((s, d) => s + d.delayDays, 0);

  const causes: DelayCause[] = Array.from(categoryMap.entries())
    .map(([cat, data]) => ({
      category: cat,
      totalDays: data.totalDays,
      occurrences: data.count,
      percentage:
        totalDays > 0
          ? Math.round((data.totalDays / totalDays) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.totalDays - a.totalDays);

  const mostFrequent = causes.reduce((a, b) =>
    b.occurrences > a.occurrences ? b : a,
  );
  const largest = causes[0];

  return {
    totalDelayDays: totalDays,
    causes,
    mostFrequentCause: mostFrequent.category,
    largestCause: largest.category,
  };
}

// ── Predict completion date ───────────────────────────

export function predictCompletionDate(
  startDate: string,
  originalEndDate: string,
  progressPct: number,
  elapsedDays: number,
): CompletionPrediction {
  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(originalEndDate);
  const hasValidStart = Number.isFinite(parsedStart.getTime());
  const hasValidEnd = Number.isFinite(parsedEnd.getTime());
  const start = hasValidStart ? parsedStart : hasValidEnd ? parsedEnd : null;
  const origEnd = hasValidEnd ? parsedEnd : start;

  if (!start || !origEnd) {
    return {
      originalEndDate,
      predictedEndDate: "",
      slippageDays: 0,
      confidence: "low",
      progressPct: 0.01,
    };
  }

  const plannedDuration =
    (origEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  // Earned schedule approach
  const safeProgressPct = Number.isFinite(progressPct) ? progressPct : 0;
  const safeElapsedDays = Number.isFinite(elapsedDays) ? elapsedDays : 0;
  const effectiveProgress = Math.max(0.01, Math.min(100, safeProgressPct));
  const projectedDuration = (safeElapsedDays / effectiveProgress) * 100;
  const slippageDays = Math.max(
    0,
    Math.round(projectedDuration - plannedDuration),
  );

  const predictedEnd = new Date(origEnd);
  predictedEnd.setDate(predictedEnd.getDate() + slippageDays);

  let confidence: "high" | "medium" | "low" = "medium";
  if (safeProgressPct > 70) confidence = "high";
  else if (safeProgressPct < 20) confidence = "low";

  return {
    originalEndDate,
    predictedEndDate: predictedEnd.toISOString().slice(0, 10),
    slippageDays,
    confidence,
    progressPct: effectiveProgress,
  };
}

// ── Generate timeline report ──────────────────────────

export function generateTimelineReport(opts: {
  projectName: string;
  startDate: string;
  originalEndDate: string;
  totalTasks: number;
  completedTasks: number;
  delays: DelayEntry[];
  elapsedDays: number;
}): TimelineReport {
  const progressPct =
    opts.totalTasks > 0
      ? Math.round((opts.completedTasks / opts.totalTasks) * 10000) / 100
      : 0;

  const delayAnalysis = analyzeDelay(opts.delays);
  const prediction = predictCompletionDate(
    opts.startDate,
    opts.originalEndDate,
    progressPct,
    opts.elapsedDays,
  );

  return {
    projectName: opts.projectName,
    startDate: opts.startDate,
    originalEndDate: opts.originalEndDate,
    predictedEndDate: prediction.predictedEndDate,
    totalTasks: opts.totalTasks,
    completedTasks: opts.completedTasks,
    progressPct,
    delayAnalysis,
    onTrack: prediction.slippageDays <= 3,
  };
}
