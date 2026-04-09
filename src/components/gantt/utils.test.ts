import { describe, expect, it } from "vitest";
import { addDaysBySchedule, addDaysSkipWeekends } from "./utils.js";

describe("gantt utils", () => {
  it("task-level includeWeekends overrides the project setting", () => {
    expect(addDaysSkipWeekends("2025-01-03", 1, false, true)).toBe("2025-01-04");
  });

  it("moves backward across weekends when weekends are excluded", () => {
    expect(addDaysBySchedule("2025-01-06", -1, false)).toBe("2025-01-03");
  });
});
