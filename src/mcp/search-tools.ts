import { searchProjects } from "./supabase-tools.js";
import { listEstimates } from "./estimate-tools.js";
import { listPhotos } from "./photo-tools.js";
import { listDailyReports } from "./report-tools.js";

export type SearchAllResult = {
  projects: unknown[];
  estimates: unknown[];
  photos: unknown[];
  reports: unknown[];
};

function includesQuery(value: unknown, query: string): boolean {
  return JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}

export async function searchAll(query: string): Promise<SearchAllResult> {
  const [projects, estimates, photos, reports] = await Promise.all([
    searchProjects(query),
    listEstimates(),
    listPhotos(),
    listDailyReports(),
  ]);

  return {
    projects,
    estimates: estimates.filter((estimate) => includesQuery(estimate, query)),
    photos: photos.filter((photo) => includesQuery(photo, query)),
    reports: reports.filter((report) => includesQuery(report, query)),
  };
}
