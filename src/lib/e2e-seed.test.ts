import { describe, expect, it } from "vitest";
import {
  E2E_DEMO_PROJECT_ID,
  E2E_ESTIMATES_STORAGE_KEY,
  E2E_PHOTOS_STORAGE_KEY,
  isE2ESeedAllowed,
  seedE2EDemoData,
} from "./e2e-seed.js";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("E2E demo seed", () => {
  it("allows only development and Vercel Preview environments", () => {
    expect(isE2ESeedAllowed({ isDevelopment: true, vercelEnvironment: "" })).toBe(true);
    expect(isE2ESeedAllowed({ isDevelopment: false, vercelEnvironment: "preview" })).toBe(true);
    expect(isE2ESeedAllowed({ isDevelopment: false, vercelEnvironment: "production" })).toBe(false);
    expect(isE2ESeedAllowed({ isDevelopment: false, vercelEnvironment: "" })).toBe(false);
  });

  it("seeds a reproducible project, tasks, photos, and estimate without duplicates", () => {
    const storage = createStorage();
    const now = new Date("2026-07-11T10:00:00.000Z");

    const first = seedE2EDemoData(storage, now);
    const second = seedE2EDemoData(storage, now);

    expect(first).toEqual({ projectId: E2E_DEMO_PROJECT_ID, projects: 1, tasks: 4, photos: 2, estimates: 1 });
    expect(second).toEqual(first);
    expect(JSON.parse(storage.getItem("genbahub:projects")!)).toHaveLength(1);
    expect(JSON.parse(storage.getItem("genbahub:tasks")!)).toHaveLength(4);
    expect(JSON.parse(storage.getItem(E2E_PHOTOS_STORAGE_KEY)!)).toHaveLength(2);
    expect(JSON.parse(storage.getItem(E2E_ESTIMATES_STORAGE_KEY)!)).toHaveLength(1);
    expect(JSON.parse(storage.getItem("takeoff_estimate_inject")!)).toHaveLength(3);
    expect(storage.getItem("genbahub:last-project-id")).toBe(E2E_DEMO_PROJECT_ID);
  });
});
