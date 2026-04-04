/**
 * Phase cascade shift service.
 * When tasks in a phase are delayed and overlap the start of the next phase,
 * this shifts all tasks in the subsequent phase by N days.
 */

export type CascadeTask = {
  id: string;
  projectId: string;
  startDate: string;
  endDate: string;
};

export type CascadePhaseGroup = {
  projectId: string;
  tasks: CascadeTask[];
};

/** Add N calendar days to a YYYY-MM-DD string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export type CascadeResult = {
  /** Task IDs and their new start/end dates after shift */
  shiftedTasks: Array<{
    id: string;
    newStartDate: string;
    newEndDate: string;
  }>;
  /** Number of days shifted */
  delayDays: number;
};

/**
 * Detect whether tasks in `delayedPhase` have end dates that overlap into
 * `targetPhase`'s earliest start date, and return how many days the target
 * phase should be pushed out.
 *
 * Returns null if no shift is needed.
 */
export function detectPhaseOverlap(
  delayedPhase: CascadePhaseGroup,
  targetPhase: CascadePhaseGroup,
): number | null {
  if (delayedPhase.tasks.length === 0 || targetPhase.tasks.length === 0) {
    return null;
  }

  // Latest end date of the delayed phase
  const latestEnd = delayedPhase.tasks
    .map((t) => t.endDate)
    .reduce((a, b) => (a > b ? a : b));

  // Earliest start date of the target phase
  const earliestStart = targetPhase.tasks
    .map((t) => t.startDate)
    .reduce((a, b) => (a < b ? a : b));

  if (latestEnd >= earliestStart) {
    // Overlap: compute how many days to push
    const latestEndDate = new Date(latestEnd);
    const earliestStartDate = new Date(earliestStart);
    const diffMs = latestEndDate.getTime() - earliestStartDate.getTime();
    const delayDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return delayDays > 0 ? delayDays : null;
  }

  return null;
}

/**
 * Shift all tasks in `targetPhase` by `delayDays` calendar days.
 * Returns a CascadeResult with the new dates.
 */
export function cascadeShiftPhase(
  targetPhase: CascadePhaseGroup,
  delayDays: number,
): CascadeResult {
  const shiftedTasks = targetPhase.tasks.map((t) => ({
    id: t.id,
    newStartDate: addDays(t.startDate, delayDays),
    newEndDate: addDays(t.endDate, delayDays),
  }));

  return { shiftedTasks, delayDays };
}
