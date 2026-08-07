/** laporta-beads-yf4or — Codex regression tests, 2026-08-07; commit 881e1661e67e8bcf050cf75c884e8bd741a1013b. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoShareButton } from "./PhotoShareButton.js";

const { createPhotoShareMock, getSessionMock } = vi.hoisted(() => ({
  createPhotoShareMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("../lib/photo-share.js", () => ({
  createPhotoShare: (...args: unknown[]) => createPhotoShareMock(...args),
}));

vi.mock("../infra/supabase-client.js", () => ({
  getSupabaseClient: vi.fn().mockResolvedValue({ auth: { getSession: getSessionMock } }),
}));

describe("PhotoShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "jwt-1" } } });
    createPhotoShareMock.mockResolvedValue({
      token: "photo-token",
      expiresAt: "2026-08-14T00:00:00.000Z",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("7日リンクを発行して施主用URLをクリップボードへコピーする", async () => {
    render(<PhotoShareButton projectId="project-1" />);
    await userEvent.click(screen.getByRole("button", { name: "施主に共有" }));

    await waitFor(() => expect(createPhotoShareMock).toHaveBeenCalledWith("project-1", 7, "jwt-1"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}#/share/photo-token`,
    );
    expect((await screen.findByText("リンクをコピーしました（7日間有効）")).textContent).toBe(
      "リンクをコピーしました（7日間有効）",
    );
  });
});
