import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingChecklist } from "../OnboardingChecklist.js";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("../../hooks/useHashRouter.js", () => ({ navigate }));

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders 3 steps when no projects exist", () => {
    render(<OnboardingChecklist hasProjects={false} />);
    expect(screen.getByRole("region", { name: "スタートガイド" })).toBeTruthy();
    expect(screen.getByText(/最初の案件を作成/)).toBeTruthy();
    expect(screen.getByText(/PDF見積を試す/)).toBeTruthy();
    expect(screen.getByText(/現場写真をアップロード/)).toBeTruthy();
  });

  it("marks step complete and navigates when CTA button is clicked", () => {
    render(<OnboardingChecklist hasProjects={false} />);
    const btn = screen.getByRole("button", { name: "案件を作成する" });
    fireEvent.click(btn);

    // step is now marked done (shows 完了 badge)
    expect(screen.getAllByText("完了").length).toBeGreaterThanOrEqual(1);
    // navigates to /app
    expect(navigate).toHaveBeenCalledWith("/app");
    // persisted to localStorage
    const stored = JSON.parse(localStorageMock.getItem("genbahub_checklist_steps") ?? "[]") as string[];
    expect(stored).toContain("create_project");
  });

  it("hides the checklist when all steps done AND hasProjects=true", () => {
    localStorageMock.setItem(
      "genbahub_checklist_steps",
      JSON.stringify(["create_project", "try_estimate", "upload_photo"]),
    );
    const { container } = render(<OnboardingChecklist hasProjects={true} />);
    // component returns null
    expect(container.firstChild).toBeNull();
  });

  it("still renders when all steps done but hasProjects=false", () => {
    localStorageMock.setItem(
      "genbahub_checklist_steps",
      JSON.stringify(["create_project", "try_estimate", "upload_photo"]),
    );
    render(<OnboardingChecklist hasProjects={false} />);
    expect(screen.getByRole("region", { name: "スタートガイド" })).toBeTruthy();
    expect(screen.getByText("すべてのステップが完了しました。LapoSite をお使いいただきありがとうございます！")).toBeTruthy();
  });
});
