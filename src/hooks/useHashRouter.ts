import { useSyncExternalStore } from "react";

function getHash(): string {
  return window.location.hash.slice(1) || "/";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

/** Minimal hash-based router. No dependencies. */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, getHash, () => "/");
}

export function navigate(path: string): void {
  window.location.hash = path;
}
