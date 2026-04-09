import { describe, expect, it } from "vitest";
import { addDaysSkipWeekends } from "./utils.js";

describe("gantt utils", () => {
  it("skips substitute holidays when weekends are excluded", () => {
    expect(addDaysSkipWeekends("2025-02-21", 2)).toBe("2025-02-25");
  });

  it("skips consecutive Golden Week holidays when weekends are excluded", () => {
    expect(addDaysSkipWeekends("2026-05-01", 2)).toBe("2026-05-07");
  });
});
