import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { InstallPrompt } from "./InstallPrompt.js";

const DISMISS_KEY = "pwa-install-dismissed-until";

// localStorage stub (jsdom may have --localstorage-file issues)
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(localStorageData)) delete localStorageData[k]; }),
};

function mockUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function mockStandalone(value: boolean) {
  Object.defineProperty(navigator, "standalone", {
    value,
    configurable: true,
  });
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    cleanup();
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    // Reset userAgent to non-iOS
    mockUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
    // Reset standalone to false
    mockStandalone(false);
    // Reset matchMedia
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });
  });

  it("renders nothing by default (no prompt event, no iOS)", () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("shows Android install banner when beforeinstallprompt fires", async () => {
    render(<InstallPrompt />);
    const event = new Event("beforeinstallprompt");
    const preventDefaultFn = vi.fn();
    Object.assign(event, {
      preventDefault: preventDefaultFn,
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    fireEvent(window, event);

    await Promise.resolve();
    expect(preventDefaultFn).toHaveBeenCalled();
  });

  it("shows iOS guide on iPhone user agent", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    render(<InstallPrompt />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getAllByText(/ホーム画面に追加/).length).toBeGreaterThan(0);
  });

  it("does not render when in standalone mode on iOS", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    mockStandalone(true);
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render when dismissed flag is set", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    const until = Date.now() + 1000 * 60 * 60;
    localStorageMock.setItem(DISMISS_KEY, String(until));
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("hides and sets dismiss flag when close button clicked on iOS", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    render(<InstallPrompt />);
    const closeBtn = screen.getByRole("button", { name: "閉じる" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(DISMISS_KEY, expect.any(String));
  });

  it("dismiss expiry persists 7 days in the future", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1");
    render(<InstallPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    const stored = localStorageData[DISMISS_KEY];
    if (stored) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(Number(stored)).toBeGreaterThanOrEqual(Date.now() + sevenDaysMs - 2000);
    }
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("renders iOS guide text with share instruction", () => {
    mockUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1");
    render(<InstallPrompt />);
    expect(screen.getAllByText(/ホーム画面に追加/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Safari の共有ボタン/)).toBeDefined();
  });
});
