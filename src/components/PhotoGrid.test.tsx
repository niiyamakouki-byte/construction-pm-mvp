import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoGrid } from "./PhotoGrid.js";
import type { PhotoMetadata } from "../lib/photo-organizer.js";

afterEach(cleanup);

const photos: PhotoMetadata[] = [
  {
    id: "p1",
    url: "https://example.com/photo1.jpg",
    capturedAt: "2025-03-01T10:00:00",
    projectId: "proj1",
    description: "基礎工事前",
    tags: ["before", "基礎工事"],
  },
  {
    id: "p2",
    url: "https://example.com/photo2.jpg",
    capturedAt: "2025-03-15T10:00:00",
    projectId: "proj1",
    description: "内装完了",
    tags: ["after", "内装"],
  },
  {
    id: "p3",
    url: "",
    capturedAt: "2025-03-20T10:00:00",
    projectId: "proj1",
    description: "確認写真",
    tags: [],
  },
];

describe("PhotoGrid", () => {
  it("renders empty state when no photos given", () => {
    render(<PhotoGrid photos={[]} />);
    expect(screen.getByText("写真がありません")).toBeDefined();
  });

  it("renders custom empty message", () => {
    render(<PhotoGrid photos={[]} emptyMessage="写真を追加してください" />);
    expect(screen.getByText("写真を追加してください")).toBeDefined();
  });

  it("renders all photo descriptions", () => {
    render(<PhotoGrid photos={photos} />);
    expect(screen.getByText("基礎工事前")).toBeDefined();
    expect(screen.getByText("内装完了")).toBeDefined();
    expect(screen.getByText("確認写真")).toBeDefined();
  });

  it("shows Before label for photos with before tag", () => {
    render(<PhotoGrid photos={photos} />);
    expect(screen.getByText("Before")).toBeDefined();
  });

  it("shows After label for photos with after tag", () => {
    render(<PhotoGrid photos={photos} />);
    expect(screen.getByText("After")).toBeDefined();
  });

  it("renders category color tag badges", () => {
    render(<PhotoGrid photos={photos} />);
    // getAllByText handles multiple matches for text appearing in description + badge
    expect(screen.getAllByText("基礎工事").length).toBeGreaterThan(0);
    expect(screen.getAllByText("内装").length).toBeGreaterThan(0);
  });

  it("renders photo img elements with correct alt text", () => {
    const { container } = render(<PhotoGrid photos={photos} />);
    // Use querySelectorAll to target only <img> tags (excludes SVG elements)
    const imgElems = container.querySelectorAll("img");
    expect(imgElems.length).toBe(2);
    expect(imgElems[0]?.getAttribute("alt")).toBe("基礎工事前");
  });
});
