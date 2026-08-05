import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateRangeStrip } from "./DateRangeStrip.js";

afterEach(() => cleanup());

describe("DateRangeStrip - 範囲塗り", () => {
  it("開始〜終了の日数ぶん、塗られたセルを描画する", () => {
    const { container } = render(
      <DateRangeStrip startDate="2026-08-05" endDate="2026-08-07" today="2026-08-05" />,
    );
    const painted = container.querySelectorAll('[data-testid="range-cell-painted"]');
    expect(painted).toHaveLength(3); // 8/5, 8/6, 8/7
  });

  it("開始/終了が未設定なら何も描画しない", () => {
    const { container } = render(<DateRangeStrip startDate="" endDate="" today="2026-08-05" />);
    expect(container.querySelector('[data-testid="date-range-strip"]')).toBeNull();
  });

  it("終了日が開始日より前なら何も描画しない(不正入力ガード)", () => {
    const { container } = render(
      <DateRangeStrip startDate="2026-08-10" endDate="2026-08-05" today="2026-08-05" />,
    );
    expect(container.querySelector('[data-testid="date-range-strip"]')).toBeNull();
  });
});
