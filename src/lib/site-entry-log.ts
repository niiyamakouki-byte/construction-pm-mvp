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
 * Get all records grouped by company for a project.
 * Returns a Map of companyName -> SiteEntryRecord[].
 */
export function getEntriesByCompany(
  projectId: string,
  date?: string,
): Map<string, SiteEntryRecord[]> {
  const records = getEntryLog(projectId, date);
  const map = new Map<string, SiteEntryRecord[]>();
  for (const record of records) {
    const key = record.company || "（会社未設定）";
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      map.set(key, [record]);
    }
  }
  return map;
}

/**
 * Calculate man-days (人工) for an array of records.
 * Rule: 8h = 1 man-day, each additional hour = 0.25 man-day (overtime).
 * Records without exitTime are excluded.
 */
export function calculateManDays(entries: SiteEntryRecord[]): number {
  const STANDARD_HOURS = 8;
  const OVERTIME_RATE = 0.25;

  let total = 0;
  for (const entry of entries) {
    if (!entry.exitTime) continue;
    const hours =
      (new Date(entry.exitTime).getTime() - new Date(entry.entryTime).getTime()) /
      (1000 * 60 * 60);
    if (hours <= 0) continue;
    if (hours <= STANDARD_HOURS) {
      total += hours / STANDARD_HOURS;
    } else {
      total += 1 + (hours - STANDARD_HOURS) * OVERTIME_RATE;
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Generate a CSV string from an array of records.
 * Columns: ID,氏名,会社,入場時刻,退場時刻,勤務時間(h),人工
 */
export function exportToCSV(entries: SiteEntryRecord[]): string {
  const header = "ID,氏名,会社,入場時刻,退場時刻,勤務時間(h),人工";
  const rows = entries.map((entry) => {
    const inTime = new Date(entry.entryTime).toLocaleString("ja-JP");
    const outTime = entry.exitTime ? new Date(entry.exitTime).toLocaleString("ja-JP") : "";
    let hours = "";
    let manDays = "";
    if (entry.exitTime) {
      const h =
        (new Date(entry.exitTime).getTime() - new Date(entry.entryTime).getTime()) /
        (1000 * 60 * 60);
      hours = h.toFixed(2);
      manDays = calculateManDays([entry]).toFixed(2);
    }
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      escape(entry.id),
      escape(entry.workerName),
      escape(entry.company),
      escape(inTime),
      escape(outTime),
      hours,
      manDays,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/**
 * Clear all records. Used for testing.
 */
export function clearEntryRecords(): void {
  entryRecords.length = 0;
  recordCounter = 0;
}
