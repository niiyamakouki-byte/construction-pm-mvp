import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DependencyLines } from "./DependencyLines.js";

afterEach(() => cleanup());

// [compass] 4o9m2: 依存線の紫(#7c3aed)をgenbahub-ui skin準拠のセージグリーン規範色(#346538)へ変更
describe("DependencyLines - 規範色適合(4o9m2)", () => {
  it("依存線のstrokeはセージグリーン規範色(#346538)で、旧紫(#7c3aed)は使わない", () => {
    const { container } = render(
      <DependencyLines
        lines={[{ fromTaskId: "a", toTaskId: "b", x1: 0, y1: 0, x2: 40, y2: 40 }]}
        totalDays={10}
        dayWidth={40}
      />,
    );
    const path = container.querySelector("path[stroke]") as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.getAttribute("stroke")).toBe("#346538");
    expect(container.innerHTML).not.toContain("#7c3aed");
  });

  it("矢印マーカーもセージグリーン規範色で塗られる", () => {
    const { container } = render(
      <DependencyLines
        lines={[{ fromTaskId: "a", toTaskId: "b", x1: 0, y1: 0, x2: 40, y2: 40 }]}
        totalDays={10}
        dayWidth={40}
      />,
    );
    const arrow = container.querySelector("marker#dep-arrow path") as SVGPathElement;
    expect(arrow.getAttribute("fill")).toBe("#346538");
  });
});
