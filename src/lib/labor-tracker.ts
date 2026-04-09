/**
 * Labor time tracking, overtime, crew assignment, and daily labor cost.
 */

export type LaborEntryStatus = "active" | "completed";

export type LaborTimeEntry = {
  id: string;
  projectId: string;
  workerId: string;
  workerName: string;
  trade: string;
  hourlyRate: number;
  clockInTime: string;
  clockOutTime?: string;
  crewId?: string;
  status: LaborEntryStatus;
};

export type CrewAssignment = {
  id: string;
  projectId: string;
  crewId: string;
  crewName: string;
  workerId: string;
  workerName: string;
  assignmentDate: string;
  role?: string;
};

export type OvertimeSummary = {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
};

export type DailyLaborCostSummary = OvertimeSummary & {
  date: string;
  workerCount: number;
};

const timeEntries: LaborTimeEntry[] = [];
const crewAssignments: CrewAssignment[] = [];

export function clockIn(entry: LaborTimeEntry): LaborTimeEntry {
  timeEntries.push({ ...entry });
  return entry;
}

export function clockOut(
  entryId: string,
  clockOutTime: string,
): LaborTimeEntry | null {
  const entry = timeEntries.find((item) => item.id === entryId);
  if (!entry) return null;

  entry.clockOutTime = clockOutTime;
  entry.status = "completed";
  return entry;
}

export function assignWorkerToCrew(
  assignment: CrewAssignment,
): CrewAssignment {
  crewAssignments.push({ ...assignment });
  return assignment;
}

export function getLaborEntries(
  projectId: string,
  date?: string,
): LaborTimeEntry[] {
  return timeEntries.filter(
    (entry) =>
      entry.projectId === projectId &&
      (!date || entry.clockInTime.slice(0, 10) === date),
  );
}

export function getCrewAssignments(
  projectId: string,
  date?: string,
): CrewAssignment[] {
  return crewAssignments.filter(
    (assignment) =>
      assignment.projectId === projectId &&
      (!date || assignment.assignmentDate === date),
  );
}

export function calculateOvertime(
  entry: LaborTimeEntry,
  regularHoursPerDay = 8,
  overtimeMultiplier = 1.5,
): OvertimeSummary {
  const totalHours = getEntryHours(entry);
  const regularHours = Math.min(totalHours, regularHoursPerDay);
  const overtimeHours = Math.max(0, totalHours - regularHoursPerDay);
  const regularCost = roundCurrency(regularHours * entry.hourlyRate);
  const overtimeCost = roundCurrency(
    overtimeHours * entry.hourlyRate * overtimeMultiplier,
  );

  return {
    totalHours,
    regularHours,
    overtimeHours,
    regularCost,
    overtimeCost,
    totalCost: roundCurrency(regularCost + overtimeCost),
  };
}

export function calculateDailyLaborCost(
  projectId: string,
  date: string,
  regularHoursPerDay = 8,
  overtimeMultiplier = 1.5,
): DailyLaborCostSummary {
  const entries = getLaborEntries(projectId, date).filter((entry) => entry.clockOutTime);

  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let regularCost = 0;
  let overtimeCost = 0;

  for (const entry of entries) {
    const summary = calculateOvertime(
      entry,
      regularHoursPerDay,
      overtimeMultiplier,
    );
    totalHours += summary.totalHours;
    regularHours += summary.regularHours;
    overtimeHours += summary.overtimeHours;
    regularCost += summary.regularCost;
    overtimeCost += summary.overtimeCost;
  }

  return {
    date,
    totalHours: roundHours(totalHours),
    regularHours: roundHours(regularHours),
    overtimeHours: roundHours(overtimeHours),
    regularCost: roundCurrency(regularCost),
    overtimeCost: roundCurrency(overtimeCost),
    totalCost: roundCurrency(regularCost + overtimeCost),
    workerCount: entries.length,
  };
}

function getEntryHours(entry: LaborTimeEntry): number {
  if (!entry.clockOutTime) return 0;

  const start = new Date(entry.clockInTime).getTime();
  const end = new Date(entry.clockOutTime).getTime();
  const msPerHour = 1000 * 60 * 60;
  return roundHours(Math.max(0, end - start) / msPerHour);
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function _resetLaborStore(): void {
  timeEntries.length = 0;
  crewAssignments.length = 0;
}
