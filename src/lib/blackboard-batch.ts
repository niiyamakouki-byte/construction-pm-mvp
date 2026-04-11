/**
 * Batch creation helpers for digital blackboard data.
 * Supports CSV import and bulk BlackboardData generation.
 */

import type { BlackboardData } from "./digital-blackboard.js";

export type CSVRow = {
  工事名: string;
  工種: string;
  撮影箇所: string;
  撮影日: string;
  天気: string;
  施工者: string;
  備考: string;
};

export type ValidationError = {
  row: number;
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

const CSV_HEADERS: (keyof CSVRow)[] = [
  "工事名",
  "工種",
  "撮影箇所",
  "撮影日",
  "天気",
  "施工者",
  "備考",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a single CSV row object.
 * Returns a ValidationResult with any field-level errors.
 */
export function validateCSVRow(row: Partial<CSVRow>, rowIndex: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (!row.工事名 || row.工事名.trim() === "") {
    errors.push({ row: rowIndex, field: "工事名", message: "工事名は必須です" });
  }

  if (!row.工種 || row.工種.trim() === "") {
    errors.push({ row: rowIndex, field: "工種", message: "工種は必須です" });
  }

  if (!row.撮影箇所 || row.撮影箇所.trim() === "") {
    errors.push({ row: rowIndex, field: "撮影箇所", message: "撮影箇所は必須です" });
  }

  if (!row.撮影日 || row.撮影日.trim() === "") {
    errors.push({ row: rowIndex, field: "撮影日", message: "撮影日は必須です" });
  } else if (!DATE_PATTERN.test(row.撮影日.trim())) {
    errors.push({
      row: rowIndex,
      field: "撮影日",
      message: "撮影日はYYYY-MM-DD形式で入力してください",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse a CSV string into an array of CSVRow objects.
 * The first line must be the header row matching CSV_HEADERS order.
 * Rows with all-empty cells are silently skipped.
 */
export function parseBlackboardCSV(csvString: string): CSVRow[] {
  const lines = csvString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const rows: CSVRow[] = [];

  // Skip header row (index 0), process data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]!);

    // Skip rows where all columns are empty
    if (cols.every((c) => c === "")) continue;

    const row: Partial<CSVRow> = {};
    for (let j = 0; j < CSV_HEADERS.length; j++) {
      const header = CSV_HEADERS[j]!;
      row[header] = (cols[j] ?? "").trim();
    }

    rows.push(row as CSVRow);
  }

  return rows;
}

/**
 * Split a single CSV line respecting double-quoted fields.
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Convert an array of CSVRow objects into BlackboardData objects.
 * Rows that fail validation are skipped; their errors are collected.
 */
export function generateBatchBlackboards(rows: CSVRow[]): {
  blackboards: BlackboardData[];
  errors: ValidationError[];
} {
  const blackboards: BlackboardData[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const result = validateCSVRow(row, i + 1);
    if (!result.valid) {
      errors.push(...result.errors);
      continue;
    }

    blackboards.push({
      projectName: row.工事名.trim(),
      workType: row.工種.trim(),
      location: row.撮影箇所.trim(),
      shootDate: row.撮影日.trim(),
      condition: [row.天気, row.備考].filter(Boolean).join(" / "),
    });
  }

  return { blackboards, errors };
}
