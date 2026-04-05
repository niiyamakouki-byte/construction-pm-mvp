/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { parseScheduleImportFile } from "./schedule-importer.js";
import { createMockXlsxBuffer } from "./test-utils.js";

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
