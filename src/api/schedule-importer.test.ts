/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { parseFlexibleScheduleDate, parseScheduleImportFile } from "./schedule-importer";
import { createMockXlsxBuffer } from "./test-utils";

describe("schedule importer", () => {
  it("Japanese headers を自動検出して Excel を取り込める", () => {
    const buffer = createMockXlsxBuffer([
      ["工事名", "開始日", "完了日", "業者", "備考"],
      ["軽量下地", "2026/4/10", "2026年4月12日", "山田内装", "先行施工"],
    ]);

    const tasks = parseScheduleImportFile({
      buffer,
      filename: "schedule.xlsx",
    });

    expect(tasks).toEqual([
      {
        name: "軽量下地",
        startDate: "2026-04-10",
        endDate: "2026-04-12",
        contractor: "山田内装",
        description: "先行施工",
      },
    ]);
  });

  it("English headers を自動検出して Excel を取り込める", () => {
    const buffer = createMockXlsxBuffer([
      ["Task Name", "Start Date", "End Date", "Vendor", "Notes"],
      ["Board work", "2026-04-14", "2026-04-18", "ACME", "Level 2"],
    ]);

    const tasks = parseScheduleImportFile({
      buffer,
      filename: "schedule.xlsx",
    });

    expect(tasks).toEqual([
      {
        name: "Board work",
        startDate: "2026-04-14",
        endDate: "2026-04-18",
        contractor: "ACME",
        description: "Level 2",
      },
    ]);
  });

  it("CSV も取り込める", () => {
    const tasks = parseScheduleImportFile({
      buffer: Buffer.from(
        [
          "Task Name,Start Date,End Date,Vendor,Notes",
          "Board work,2026/4/14,R8.4.18,ACME,Level 2",
        ].join("\n"),
        "utf8",
      ),
      filename: "schedule.csv",
    });

    expect(tasks).toEqual([
      {
        name: "Board work",
        startDate: "2026-04-14",
        endDate: "2026-04-18",
        contractor: "ACME",
        description: "Level 2",
      },
    ]);
  });

  it("日本の代表的な日付表記ゆれを正規化できる", () => {
    const buffer = createMockXlsxBuffer([
      ["作業名", "着工日", "竣工日"],
      ["墨出し", "R8.4.10", "2026/4/11"],
      ["ボード張り", "2026年4月12日", "R8.4.15"],
    ]);

    const tasks = parseScheduleImportFile({
      buffer,
      filename: "dates.xlsx",
    });

    expect(tasks).toEqual([
      {
        name: "墨出し",
        startDate: "2026-04-10",
        endDate: "2026-04-11",
      },
      {
        name: "ボード張り",
        startDate: "2026-04-12",
        endDate: "2026-04-15",
      },
    ]);
  });

  it("和暦の元年と改元境界日を正しく解釈できる", () => {
    expect(parseFlexibleScheduleDate("令和元年5月1日")).toBe("2019-05-01");
    expect(parseFlexibleScheduleDate("H31.4.30")).toBe("2019-04-30");
    expect(parseFlexibleScheduleDate("昭和64年1月7日")).toBe("1989-01-07");
  });

  it("改元後の存在しない和暦日付は弾く", () => {
    expect(() => parseFlexibleScheduleDate("平成31年5月1日")).toThrowError("日付が不正です。");
    expect(() => parseFlexibleScheduleDate("R1.4.30")).toThrowError("日付が不正です。");
  });

  it("必須列が不足している場合はエラーを返す", () => {
    const buffer = createMockXlsxBuffer([
      ["作業名", "業者", "備考"],
      ["墨出し", "山田内装", "先行"],
    ]);

    expect(() =>
      parseScheduleImportFile({
        buffer,
        filename: "missing-columns.xlsx",
      }),
    ).toThrowError("必須列が不足しています: 開始日、終了日");
  });
});
