const LAST_PROJECT_KEY = "genbahub:last-project-id";

export function readLastProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_PROJECT_KEY);
}

export function writeLastProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
}
