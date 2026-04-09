import { describe, expect, it } from "vitest";
import {
  JAPANESE_HOLIDAYS_2025_2027,
  getHolidayName,
  isHoliday,
} from "../lib/japanese-holidays.js";

describe("japanese-holidays", () => {
  it("contains the official holiday master data for 2025-2027", () => {
    expect(getHolidayName("2025-01-01")).toBe("元日");
    expect(getHolidayName("2026-09-23")).toBe("秋分の日");
    expect(getHolidayName("2027-10-11")).toBe("スポーツの日");
    expect(JAPANESE_HOLIDAYS_2025_2027["2025-11-03"]).toBe("文化の日");
  });

  it("marks substitute holidays when a holiday falls on Sunday", () => {
    expect(isHoliday("2025-02-24")).toBe(true);
    expect(getHolidayName("2025-02-24")).toBe("振替休日");
    expect(getHolidayName("2026-05-06")).toBe("振替休日");
    expect(getHolidayName("2027-03-22")).toBe("振替休日");
  });

  it("marks citizens holidays created between two national holidays", () => {
    expect(isHoliday("2026-09-22")).toBe(true);
    expect(getHolidayName("2026-09-22")).toBe("国民の休日");
    expect(isHoliday("2025-09-22")).toBe(false);
  });
});
