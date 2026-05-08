import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRegisterSW, mockUpdateSW } = vi.hoisted(() => {
  const mockUpdateSW = vi.fn();
  const mockRegisterSW = vi.fn().mockReturnValue(mockUpdateSW);
  return { mockRegisterSW, mockUpdateSW };
});

vi.mock("virtual:pwa-register", () => ({
  registerSW: mockRegisterSW,
}));

import { registerServiceWorker } from "./sw-registration.js";

describe("registerServiceWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterSW.mockReturnValue(mockUpdateSW);
  });

  it("calls registerSW with onNeedRefresh and onOfflineReady callbacks", () => {
    registerServiceWorker();
    expect(mockRegisterSW).toHaveBeenCalledTimes(1);
    const options = mockRegisterSW.mock.calls[0][0];
    expect(typeof options.onNeedRefresh).toBe("function");
    expect(typeof options.onOfflineReady).toBe("function");
  });

  it("calls updateSW(true) when onNeedRefresh fires", () => {
    registerServiceWorker();
    const options = mockRegisterSW.mock.calls[0][0];
    options.onNeedRefresh();
    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });

  it("does not throw when onOfflineReady fires", () => {
    registerServiceWorker();
    const options = mockRegisterSW.mock.calls[0][0];
    expect(() => options.onOfflineReady()).not.toThrow();
  });

  it("does not throw when onRegistered fires with undefined", () => {
    registerServiceWorker();
    const options = mockRegisterSW.mock.calls[0][0];
    expect(() => options.onRegistered(undefined)).not.toThrow();
  });

  it("does not throw when onRegisterError fires", () => {
    registerServiceWorker();
    const options = mockRegisterSW.mock.calls[0][0];
    expect(() => options.onRegisterError(new Error("fail"))).not.toThrow();
  });
});
