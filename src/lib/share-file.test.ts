import { describe, it, expect, vi, afterEach } from "vitest";
import { shareOrDownloadFile } from "./share-file.js";

describe("shareOrDownloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses navigator.share when file sharing is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const file = new File(["x"], "test.png", { type: "image/png" });
    await shareOrDownloadFile(file);

    expect(share).toHaveBeenCalledWith({ files: [file], title: "test.png" });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("falls back to a download link when the share API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectUrl = vi.fn().mockReturnValue("blob:test-url");
    const revokeObjectUrl = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectUrl }).createObjectURL = createObjectUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectUrl }).revokeObjectURL = revokeObjectUrl;

    const file = new File(["x"], "test.png", { type: "image/png" });
    await shareOrDownloadFile(file);

    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-url");
  });
});
