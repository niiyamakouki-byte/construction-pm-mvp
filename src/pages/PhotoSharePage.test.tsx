/** laporta-beads-yf4or — Codex regression tests, 2026-08-07. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhotoSharePage } from "./PhotoSharePage.js";

vi.mock("../lib/photo-share.js", () => ({
  readPhotoShare: vi.fn().mockResolvedValue({
    projectId: "project-1",
    projectName: "青山邸",
    expiresAt: "2026-08-14T00:00:00.000Z",
    photos: [
      {
        id: "photo-1",
        url: "https://signed.example/photo.jpg",
        fileName: "外観.jpg",
        category: "外装",
        caption: "足場解体後",
        takenAt: "2026-08-06T01:00:00.000Z",
      },
    ],
  }),
}));

vi.mock("../components/PhotoGrid.js", () => ({
  PhotoGrid: ({ photos }: { photos: Array<{ description: string }> }) => (
    <div data-testid="photo-grid">{photos[0]?.description}</div>
  ),
}));

describe("PhotoSharePage", () => {
  it("認証UIなしで共有案件名と写真を表示する", async () => {
    render(<PhotoSharePage token="public-photo-token" />);
    expect((await screen.findByRole("heading", { name: "青山邸" })).textContent).toBe("青山邸");
    expect(screen.getByTestId("photo-grid").textContent).toContain("足場解体後");
  });
});
