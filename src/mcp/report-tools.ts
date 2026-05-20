import {
  generateDailyReport as renderDailyReport,
  type DailyReportInput,
} from "../lib/daily-report-generator.js";

export type DailyReportRecord = {
  id: string;
  project_id: string;
  date: string;
  body: string;
  attendees: string[];
  created_at: string;
  updated_at: string;
};

const reports = new Map<string, DailyReportRecord>();

function reportId(projectId: string, date: string): string {
  return `daily-report-${projectId}-${date}`;
}

export async function createDailyReport(input: {
  project_id: string;
  date: string;
  body: string;
  attendees?: string[];
}): Promise<DailyReportRecord> {
  const now = new Date().toISOString();
  const id = reportId(input.project_id, input.date);
  const report: DailyReportRecord = {
    id,
    project_id: input.project_id,
    date: input.date,
    body: input.body,
    attendees: input.attendees ?? [],
    created_at: reports.get(id)?.created_at ?? now,
    updated_at: now,
  };
  reports.set(id, report);
  return { ...report, attendees: [...report.attendees] };
}

export async function listDailyReports(input: {
  project_id?: string;
  date_from?: string;
  date_to?: string;
} = {}): Promise<DailyReportRecord[]> {
  return [...reports.values()]
    .filter((report) => !input.project_id || report.project_id === input.project_id)
    .filter((report) => !input.date_from || report.date >= input.date_from)
    .filter((report) => !input.date_to || report.date <= input.date_to)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((report) => ({ ...report, attendees: [...report.attendees] }));
}

export async function generateDailyReport(input: { project_id: string; date: string }): Promise<{ html: string }> {
  const generatorInput: DailyReportInput = {
    project: {
      id: input.project_id,
      name: input.project_id,
      description: "",
      status: "active",
      startDate: input.date,
      includeWeekends: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    date: input.date,
    tasks: [],
    contractors: [],
  };

  return { html: renderDailyReport(generatorInput) };
}
