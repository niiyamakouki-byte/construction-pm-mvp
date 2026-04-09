const LAST_PROJECT_KEY = "genbahub:last-project-id";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage) return null;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
}

export function readLastProjectId(): string | null {
  return getLocalStorage()?.getItem(LAST_PROJECT_KEY) ?? null;
}

export function writeLastProjectId(projectId: string): void {
  getLocalStorage()?.setItem(LAST_PROJECT_KEY, projectId);
}
