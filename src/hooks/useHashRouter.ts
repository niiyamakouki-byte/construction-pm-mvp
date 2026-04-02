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

/** Routes that are accessible without authentication. */
export const PUBLIC_ROUTES = ["/", "/login", "/signup", "/pricing", "/legal"];

export function isPublicRoute(route: string): boolean {
  return PUBLIC_ROUTES.some((pub) => route === pub || route.startsWith(pub + "#"));
}
