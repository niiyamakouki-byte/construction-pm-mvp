/**
 * Calendar Export module for GenbaHub.
 * Generates iCalendar (.ics) files from project tasks,
 * compatible with Google Calendar import.
 */

import type { Project, Task } from "../domain/types.js";

function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatICSDateTime(dateStr: string): string {
  return `${dateStr.replace(/-/g, "")}T000000`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function generateUID(taskId: string, projectId: string): string {
  return `${taskId}-${projectId}@genbahub`;
}

function daysBetweenDates(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function addOneDayICS(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Export project tasks to iCalendar (.ics) format string.
 * Each task becomes a VEVENT with start/end dates.
 * Tasks starting within 3 days get a VALARM reminder.
 */
export function exportToICS(
  project: Project,
  tasks: Task[],
  today?: string,
): string {
  const nowDate = today ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//GenbaHub//Construction PM//JP");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeICSText(project.name)}`);

  for (const task of tasks) {
    if (!task.startDate) continue;

    const startDate = task.startDate;
    const endDate = task.dueDate ?? task.startDate;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${generateUID(task.id, project.id)}`);
    lines.push(`DTSTAMP:${formatICSDateTime(nowDate)}`);
    // Use VALUE=DATE for all-day events
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(startDate)}`);
    // iCal DTEND for all-day events is exclusive, so add 1 day
    lines.push(`DTEND;VALUE=DATE:${addOneDayICS(endDate)}`);
    lines.push(`SUMMARY:${escapeICSText(task.name)}`);

    if (task.description) {
      lines.push(`DESCRIPTION:${escapeICSText(task.description)}`);
    }

    lines.push(`STATUS:${task.status === "done" ? "COMPLETED" : "CONFIRMED"}`);

    // Add alarm for tasks starting within 3 days
    const daysUntilStart = daysBetweenDates(nowDate, startDate);
    if (daysUntilStart >= 0 && daysUntilStart <= 3) {
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-PT30M");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeICSText(task.name)} starts soon`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}
