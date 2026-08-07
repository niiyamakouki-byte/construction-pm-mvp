import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourGuide } from "../TourGuide.js";

describe("TourGuide", () => {
  beforeEach(() => {
    window.location.hash = "/gantt/proj-1";
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("closes when the hash route changes (construction_pm_mvp-5y1)", () => {
    const onComplete = vi.fn();
    render(<TourGuide onComplete={onComplete} />);

    expect(screen.getByText("ここが工程表です")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    // Simulate navigating away to an unrelated page (e.g. via sidebar link)
    // without pressing 次へ/スキップ on the tour.
    act(() => {
      window.location.hash = "/estimate";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not close on initial mount", () => {
    const onComplete = vi.fn();
    render(<TourGuide onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
