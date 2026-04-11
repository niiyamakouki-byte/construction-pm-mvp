import { describe, it, expect } from "vitest";
import {
  parseBlackboardCSV,
  generateBatchBlackboards,
  validateCSVRow,
  type CSVRow,
} from "../lib/blackboard-batch.js";

const HEADER = "工事名,工種,撮影箇所,撮影日,天気,施工者,備考";

function makeRow(overrides: Partial<CSVRow> = {}): CSVRow {
  return {
    工事名: "南青山リノベーション",
    工種: "クロス仕上",
    撮影箇所: "1F洋室",
    撮影日: "2025-04-01",
    天気: "晴れ",
    施工者: "田中",
    備考: "施工中",
    ...overrides,
  };
}

// ── parseBlackboardCSV ────────────────────────────────────────────────────

describe("parseBlackboardCSV", () => {
  it("parses a single data row", () => {
    const csv = [HEADER, "南青山リノベーション,クロス仕上,1F洋室,2025-04-01,晴れ,田中,施工中"].join(
      "\n"
    );
    const rows = parseBlackboardCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.工事名).toBe("南青山リノベーション");
    expect(rows[0]?.工種).toBe("クロス仕上");
    expect(rows[0]?.撮影日).toBe("2025-04-01");
  });

  it("parses multiple data rows", () => {
    const csv = [
      HEADER,
      "工事A,床撤去,1F全体,2025-04-01,曇り,鈴木,着工前",
      "工事B,軽鉄下地,2F壁,2025-04-02,晴れ,田中,施工中",
      "工事C,クロス仕上,3F天井,2025-04-03,晴れ,中村,完了",
    ].join("\n");
    const rows = parseBlackboardCSV(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.工事名).toBe("工事B");
  });

  it("returns empty array when only header exists", () => {
    const rows = parseBlackboardCSV(HEADER);
    expect(rows).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseBlackboardCSV("")).toEqual([]);
  });

  it("skips blank lines between rows", () => {
    const csv = [HEADER, "工事A,床撤去,1F,2025-04-01,晴れ,田中,", "", "工事B,壁撤去,2F,2025-04-02,曇り,鈴木,"].join(
      "\n"
    );
    const rows = parseBlackboardCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it("handles quoted fields containing commas", () => {
    const csv = [HEADER, '"東京,南青山工事",クロス仕上,1F洋室,2025-04-01,晴れ,田中,'].join("\n");
    const rows = parseBlackboardCSV(csv);
    expect(rows[0]?.工事名).toBe("東京,南青山工事");
  });

  it("trims whitespace from field values", () => {
    const csv = [HEADER, "  工事A ,  床撤去 ,  1F ,  2025-04-01 ,  晴れ ,  田中 ,  "].join("\n");
    const rows = parseBlackboardCSV(csv);
    expect(rows[0]?.工事名).toBe("工事A");
    expect(rows[0]?.工種).toBe("床撤去");
  });

  it("handles CRLF line endings", () => {
    const csv = [HEADER, "工事A,床撤去,1F,2025-04-01,晴れ,田中,"].join("\r\n");
    const rows = parseBlackboardCSV(csv);
    expect(rows).toHaveLength(1);
  });
});

// ── validateCSVRow ────────────────────────────────────────────────────────

describe("validateCSVRow", () => {
  it("returns valid=true for a complete row", () => {
    const result = validateCSVRow(makeRow(), 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports error when 工事名 is missing", () => {
    const result = validateCSVRow(makeRow({ 工事名: "" }), 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "工事名")).toBe(true);
  });

  it("reports error when 工種 is missing", () => {
    const result = validateCSVRow(makeRow({ 工種: "" }), 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "工種")).toBe(true);
  });

  it("reports error when 撮影箇所 is missing", () => {
    const result = validateCSVRow(makeRow({ 撮影箇所: "" }), 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "撮影箇所")).toBe(true);
  });

  it("reports error when 撮影日 is missing", () => {
    const result = validateCSVRow(makeRow({ 撮影日: "" }), 3);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "撮影日")).toBe(true);
  });

  it("reports error when 撮影日 has invalid format", () => {
    const result = validateCSVRow(makeRow({ 撮影日: "2025/04/01" }), 4);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "撮影日")).toBe(true);
  });

  it("includes row index in error objects", () => {
    const result = validateCSVRow(makeRow({ 工事名: "" }), 5);
    expect(result.errors[0]?.row).toBe(5);
  });

  it("allows empty 天気 and 備考 (optional fields)", () => {
    const result = validateCSVRow(makeRow({ 天気: "", 備考: "" }), 1);
    expect(result.valid).toBe(true);
  });
});

// ── generateBatchBlackboards ──────────────────────────────────────────────

describe("generateBatchBlackboards", () => {
  it("converts valid CSVRow array to BlackboardData array", () => {
    const rows = [makeRow()];
    const { blackboards, errors } = generateBatchBlackboards(rows);
    expect(errors).toHaveLength(0);
    expect(blackboards).toHaveLength(1);
    expect(blackboards[0]?.projectName).toBe("南青山リノベーション");
    expect(blackboards[0]?.workType).toBe("クロス仕上");
    expect(blackboards[0]?.location).toBe("1F洋室");
    expect(blackboards[0]?.shootDate).toBe("2025-04-01");
  });

  it("skips invalid rows and collects their errors", () => {
    const rows = [makeRow(), makeRow({ 工事名: "" }), makeRow({ 撮影日: "invalid" })];
    const { blackboards, errors } = generateBatchBlackboards(rows);
    expect(blackboards).toHaveLength(1);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty arrays for empty input", () => {
    const { blackboards, errors } = generateBatchBlackboards([]);
    expect(blackboards).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("processes large batches correctly", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({ 工事名: `工事${i + 1}`, 撮影日: "2025-04-01" })
    );
    const { blackboards, errors } = generateBatchBlackboards(rows);
    expect(errors).toHaveLength(0);
    expect(blackboards).toHaveLength(20);
  });
});

// ── round-trip: parseBlackboardCSV → generateBatchBlackboards ─────────────

describe("CSV round-trip", () => {
  it("full pipeline produces correct BlackboardData from CSV string", () => {
    const csv = [
      HEADER,
      "南青山内装工事,フローリング仕上,2F居室,2025-05-10,晴れ,山田,施工中",
    ].join("\n");
    const rows = parseBlackboardCSV(csv);
    const { blackboards } = generateBatchBlackboards(rows);
    expect(blackboards[0]?.projectName).toBe("南青山内装工事");
    expect(blackboards[0]?.workType).toBe("フローリング仕上");
    expect(blackboards[0]?.shootDate).toBe("2025-05-10");
  });
});
