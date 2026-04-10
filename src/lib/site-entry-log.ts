/**
 * Site Entry Log module for GenbaHub.
 * Tracks worker entry and exit records per project using in-memory storage
 * (same pattern as labor-tracker.ts).
 */

export type SiteEntryRecord = {
  id: string;
  projectId: string;
  workerName: string;
  company: string;
  entryTime: string;
  exitTime?: string;
};

// In-memory store (matches pattern of other lib modules in this codebase)
const entryRecords: SiteEntryRecord[] = [];
let recordCounter = 0;

/**
 * Log a worker entry. Returns the new record.
 */
export function logEntry(
  projectId: string,
  workerName: string,
  company: string,
): SiteEntryRecord {
  if (!projectId) throw new Error("projectId is required");
  if (!workerName.trim()) throw new Error("workerName is required");

  recordCounter += 1;
  const record: SiteEntryRecord = {
    id: `entry-${recordCounter}`,
    projectId,
    workerName: workerName.trim(),
    company: company.trim(),
    entryTime: new Date().toISOString(),
  };
  entryRecords.push(record);
  return record;
}

/**
 * Log a worker exit. Updates exitTime on the matching record.
 * Returns the updated record, or null if not found.
 */
export function logExit(recordId: string): SiteEntryRecord | null {
  const record = entryRecords.find((r) => r.id === recordId);
  if (!record) return null;
  record.exitTime = new Date().toISOString();
  return record;
}

/**
 * Get entry log for a project, optionally filtered by date (YYYY-MM-DD).
 */
export function getEntryLog(
  projectId: string,
  date?: string,
): SiteEntryRecord[] {
  return entryRecords.filter((r) => {
    if (r.projectId !== projectId) return false;
    if (date) {
      return r.entryTime.startsWith(date);
    }
    return true;
  });
}

/**
 * Get the count of workers currently on site (entered but not yet exited) today.
 */
export function getTodayWorkerCount(projectId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return entryRecords.filter(
    (r) =>
      r.projectId === projectId &&
      r.entryTime.startsWith(today) &&
      !r.exitTime,
  ).length;
}

/**
 * Clear all records. Used for testing.
 */
export function clearEntryRecords(): void {
  entryRecords.length = 0;
  recordCounter = 0;
}
