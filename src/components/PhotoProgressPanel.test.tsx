import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoProgressPanel } from "./PhotoProgressPanel.js";
import type { PhotoMetadata } from "../lib/photo-organizer.js";

afterEach(cleanup);

const makePhoto = (overrides: Partial<PhotoMetadata> & Pick<PhotoMetadata, "id">): PhotoMetadata => ({
  url: "https://example.com/photo.jpg",
  capturedAt: "2025-04-01T10:00:00",
  projectId: "proj-1",
  description: "",
  tags: [],
  ...overrides,
});

const photos: PhotoMetadata[] = [
  makePhoto({ id: "p1", tags: ["after", "内装仕上"], description: "内装完了" }),
  makePhoto({ id: "p2", tags: ["before", "解体"], description: "解体前" }),
  makePhoto({ id: "p3", tags: ["塗装"], description: "塗装中間" }),
];

describe("PhotoProgressPanel", () => {
  it("renders nothing when no photos provided", () => {
    const { container } = render(<PhotoProgressPanel photos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows 進捗を分析 button before analysis", () => {
    render(<PhotoProgressPanel photos={photos} />);
    expect(screen.getByRole("button", { name: "進捗を分析" })).toBeDefined();
  });

  it("does not show analysis results before button click", () => {
    render(<PhotoProgressPanel photos={photos} />);
    expect(document.querySelector("[data-testid='progress-analysis-results']")).toBeNull();
  });

  it("shows analysis results after clicking 進捗を分析", () => {
    render(<PhotoProgressPanel photos={photos} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    expect(document.querySelector("[data-testid='progress-analysis-results']")).toBeDefined();
  });

  it("displays photo count in the analysis header", () => {
    render(<PhotoProgressPanel photos={photos} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    expect(screen.getByText(`${photos.length}枚から推定`)).toBeDefined();
  });

  it("shows 工種別進捗分析 heading after analysis", () => {
    render(<PhotoProgressPanel photos={photos} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    expect(screen.getByText("工種別進捗分析")).toBeDefined();
  });

  it("renders trade rows with % values", () => {
    render(<PhotoProgressPanel photos={photos} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    // At least one trade row with a percentage should appear
    const pctValues = screen.getAllByText(/\d+%/);
    expect(pctValues.length).toBeGreaterThan(0);
  });

  it("maps 'after' tag to 100% completion", () => {
    const afterPhoto = [makePhoto({ id: "a1", tags: ["after", "内装仕上"] })];
    render(<PhotoProgressPanel photos={afterPhoto} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    expect(screen.getByText("100%")).toBeDefined();
  });

  it("maps 'before' tag to 0% completion", () => {
    const beforePhoto = [makePhoto({ id: "b1", tags: ["before", "解体"] })];
    render(<PhotoProgressPanel photos={beforePhoto} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("shows 信頼度 label in results", () => {
    render(<PhotoProgressPanel photos={photos} />);
    fireEvent.click(screen.getByRole("button", { name: "進捗を分析" }));
    const confLabels = screen.getAllByText(/信頼度\d+%/);
    expect(confLabels.length).toBeGreaterThan(0);
  });
});
