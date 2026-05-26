/**
 * ChangeRequestAdminPanel.test.tsx — Sprint 71
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ChangeRequestAdminPanel } from "../ChangeRequestAdminPanel.js";
import { ownerStore } from "../../lib/owner-app/owner-store.js";
import type { ChangeRequest } from "../../lib/owner-app/types.js";

// jsdom localStorage モック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

function seedRequest(projectId: string, overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  const req: ChangeRequest = {
    id: `req-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    title: "床材変更",
    body: "オーク→ウォルナットに変更したい",
    photo_urls: [],
    status: "pending",
    ts: "2026-05-13T00:00:00.000Z",
    ...overrides,
  };
  ownerStore.submitChangeRequest(projectId, req);
  return req;
}

beforeEach(() => {
  localStorage.clear();
  ownerStore._reset();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ChangeRequestAdminPanel", () => {
  it("renders empty state when no requests", () => {
    render(<ChangeRequestAdminPanel projectId="proj-empty" />);
    expect(screen.getByText(/要望はまだありません/)).toBeTruthy();
  });

  it("lists requests for the matching project", () => {
    seedRequest("proj-x", { title: "床材変更" });
    seedRequest("proj-other", { title: "他案件" });
    render(<ChangeRequestAdminPanel projectId="proj-x" />);
    expect(screen.getByText("床材変更")).toBeTruthy();
    expect(screen.queryByText("他案件")).toBeNull();
  });

  it("updates status to approved with cost when 承認 clicked", () => {
    const req = seedRequest("proj-y", { title: "壁紙追加" });
    render(<ChangeRequestAdminPanel projectId="proj-y" />);
    const input = screen.getByPlaceholderText("未入力") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50000" } });
    fireEvent.click(screen.getByText("承認"));
    const { requests } = ownerStore.getSnapshot("proj-y");
    const updated = requests.find((r) => r.id === req.id);
    expect(updated?.status).toBe("approved");
    expect(updated?.estimated_cost).toBe(50000);
  });

  it("updates status to rejected without cost change", () => {
    const req = seedRequest("proj-z", { title: "却下対象" });
    render(<ChangeRequestAdminPanel projectId="proj-z" />);
    fireEvent.click(screen.getByText("却下"));
    const { requests } = ownerStore.getSnapshot("proj-z");
    expect(requests.find((r) => r.id === req.id)?.status).toBe("rejected");
  });

  it("updates status to reviewing", () => {
    const req = seedRequest("proj-rev", { title: "確認中候補" });
    render(<ChangeRequestAdminPanel projectId="proj-rev" />);
    fireEvent.click(screen.getByText("確認中"));
    const { requests } = ownerStore.getSnapshot("proj-rev");
    expect(requests.find((r) => r.id === req.id)?.status).toBe("reviewing");
  });
});
