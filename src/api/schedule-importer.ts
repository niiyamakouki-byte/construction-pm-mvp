import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";

export type ImportedScheduleTask = {
  name: string;
  startDate: string;
  endDate: string;
  contractor?: string;
  description?: string;
};

type ParsedCell = string | number | boolean | null;
type ParsedRow = ParsedCell[];

const REQUIRED_COLUMN_KEYS = ["name", "startDate", "endDate"] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  name: [
    "工事名",
    "作業名",
    "工程名",
    "タスク名",
    "name",
    "task",
    "taskname",
    "workname",
    "projectname",
  ],
  startDate: [
    "開始日",
    "着工日",
    "start",
    "startdate",
    "begindate",
  ],
  endDate: [
    "完了日",
    "竣工日",
    "終了日",
    "end",
    "enddate",
    "finishdate",
    "completiondate",
    "duedate",
  ],
  contractor: [
    "担当",
    "業者",
    "担当者",
    "contractor",
    "vendor",
    "assignee",
    "responsible",
  ],
  description: [
    "備考",
    "説明",
    "description",
    "note",
    "notes",
    "remark",
    "remarks",
    "comment",
  ],
};

export function parseScheduleImportFile(input: {
  buffer: Uint8Array;
  filename: string;
}): ImportedScheduleTask[] {
  const fileExtension = extname(input.filename).toLowerCase();
  const rows = parseRows(input.buffer, fileExtension);
  return mapRowsToTasks(rows);
}

export function parseFlexibleScheduleDate(value: ParsedCell | Date, fieldLabel = "日付"): string {
  if (value instanceof Date) {
    return formatIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), fieldLabel);
  }

  if (typeof value === "number") {
    return excelSerialToIsoDate(value, fieldLabel);
  }

  if (typeof value === "boolean" || value === null) {
    throw new Error(`${fieldLabel}が不正です。`);
  }

  const normalized = value.normalize("NFKC").trim();
  if (!normalized) {
    throw new Error(`${fieldLabel}は必須です。`);
  }

  const reiwaMatch =
    normalized.match(/^r\s*(\d{1,2})[./-](\d{1,2})[./-](\d{1,2})$/i) ??
    normalized.match(/^令和\s*(\d{1,2})年\s*(\d{1,2})月\s*(\d{1,2})日$/i);
  if (reiwaMatch) {
    const year = 2018 + Number(reiwaMatch[1]);
    return formatIsoDate(year, Number(reiwaMatch[2]), Number(reiwaMatch[3]), fieldLabel);
  }

  const slashMatch = normalized.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (slashMatch) {
    return formatIsoDate(
      Number(slashMatch[1]),
      Number(slashMatch[2]),
      Number(slashMatch[3]),
      fieldLabel,
    );
  }

  const japaneseMatch = normalized.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/);
  if (japaneseMatch) {
    return formatIsoDate(
      Number(japaneseMatch[1]),
      Number(japaneseMatch[2]),
      Number(japaneseMatch[3]),
      fieldLabel,
    );
  }

  throw new Error(`${fieldLabel}が不正です。`);
}

function parseRows(buffer: Uint8Array, fileExtension: string): ParsedRow[] {
  if (fileExtension === ".csv") {
    return parseCsvRows(Buffer.from(buffer).toString("utf8"));
  }

  if (isZipBuffer(buffer)) {
    return parseXlsxRows(buffer);
  }

  if (fileExtension === ".xls") {
    return parseSpreadsheetMlRows(Buffer.from(buffer).toString("utf8"));
  }

  throw new Error("対応していないファイル形式です。xlsx、xls、csv を利用してください。");
}

function mapRowsToTasks(rows: ParsedRow[]): ImportedScheduleTask[] {
  const headerRowIndex = rows.findIndex((row) => row.some((cell) => toTrimmedString(cell).length > 0));
  if (headerRowIndex === -1) {
    throw new Error("ヘッダー行が見つかりません。");
  }

  const mapping = detectColumnMapping(rows[headerRowIndex]);
  const tasks: ImportedScheduleTask[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.every((cell) => toTrimmedString(cell).length === 0)) {
      continue;
    }

    const rowNumber = index + 1;
    const name = toTrimmedString(row[mapping.name]);
    if (!name) {
      throw new Error(`${rowNumber}行目のタスク名は必須です。`);
    }

    const task: ImportedScheduleTask = {
      name,
      startDate: parseFlexibleScheduleDate(row[mapping.startDate], `${rowNumber}行目の開始日`),
      endDate: parseFlexibleScheduleDate(row[mapping.endDate], `${rowNumber}行目の終了日`),
    };

    if (task.startDate > task.endDate) {
      throw new Error(`${rowNumber}行目の開始日は終了日以前の日付を指定してください。`);
    }

    if (mapping.contractor !== undefined) {
      const contractor = toTrimmedString(row[mapping.contractor]);
      if (contractor) {
        task.contractor = contractor;
      }
    }

    if (mapping.description !== undefined) {
      const description = toTrimmedString(row[mapping.description]);
      if (description) {
        task.description = description;
      }
    }

    tasks.push(task);
  }

  return tasks;
}

function detectColumnMapping(headerRow: ParsedRow): Record<string, number | undefined> & {
  name: number;
  startDate: number;
  endDate: number;
} {
  const mapping: Record<string, number | undefined> = {};

  for (let index = 0; index < headerRow.length; index += 1) {
    const normalized = normalizeHeader(headerRow[index]);
    if (!normalized) {
      continue;
    }

    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapping[key] !== undefined) {
        continue;
      }
      if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        mapping[key] = index;
      }
    }
  }

  const missingColumns = REQUIRED_COLUMN_KEYS.filter((key) => mapping[key] === undefined);
  if (missingColumns.length > 0) {
    const labels = missingColumns.map((key) => REQUIRED_COLUMN_LABELS[key]).join("、");
    throw new Error(`必須列が不足しています: ${labels}`);
  }

  return mapping as Record<string, number | undefined> & {
    name: number;
    startDate: number;
    endDate: number;
  };
}

const REQUIRED_COLUMN_LABELS: Record<(typeof REQUIRED_COLUMN_KEYS)[number], string> = {
  name: "タスク名",
  startDate: "開始日",
  endDate: "終了日",
};

function parseCsvRows(source: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let currentCell = "";
  let currentRow: ParsedRow = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseXlsxRows(buffer: Uint8Array): ParsedRow[] {
  const files = unzipArchive(buffer);
  const sharedStringsXml = files.get("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml.toString("utf8")) : [];
  const worksheetPath = [...files.keys()]
    .filter((filePath) => /^xl\/worksheets\/[^/]+\.xml$/i.test(filePath))
    .sort()[0];

  if (!worksheetPath) {
    throw new Error("Excelワークシートが見つかりません。");
  }

  return parseWorksheetRows(files.get(worksheetPath)!.toString("utf8"), sharedStrings);
}

function parseSpreadsheetMlRows(xml: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const tableMatch = xml.match(/<Table\b[^>]*>([\s\S]*?)<\/Table>/i);
  if (!tableMatch) {
    throw new Error("Excelシートが見つかりません。");
  }

  const rowPattern = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(tableMatch[1])) !== null) {
    const row: ParsedRow = [];
    const cellPattern = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const cellIndexMatch = attrs.match(/(?:ss:Index|Index)="(\d+)"/i);
      if (cellIndexMatch) {
        const cellIndex = Number(cellIndexMatch[1]) - 1;
        while (row.length < cellIndex) {
          row.push(null);
        }
      }

      const dataMatch = cellMatch[2].match(/<Data\b[^>]*?(?:ss:Type|Type)="([^"]+)"[^>]*>([\s\S]*?)<\/Data>/i);
      if (!dataMatch) {
        row.push(null);
        continue;
      }

      const rawValue = decodeXmlEntities(dataMatch[2]);
      const type = dataMatch[1].toLowerCase();
      row.push(type === "number" ? Number(rawValue) : rawValue);
    }

    rows.push(row);
  }

  return rows;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const row: ParsedRow = [];
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] ?? "";
      const refMatch = attrs.match(/\br="([A-Z]+)\d+"/i);
      const cellIndex = refMatch ? columnLettersToIndex(refMatch[1]) : row.length;
      while (row.length < cellIndex) {
        row.push(null);
      }

      row.push(parseWorksheetCellValue(attrs, inner, sharedStrings));
    }

    rows.push(row);
  }

  return rows;
}

function parseWorksheetCellValue(
  attrs: string,
  inner: string,
  sharedStrings: string[],
): ParsedCell {
  const typeMatch = attrs.match(/\bt="([^"]+)"/i);
  const cellType = typeMatch?.[1].toLowerCase();

  if (cellType === "inlinestr") {
    return extractInlineString(inner);
  }

  const valueMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
  if (!valueMatch) {
    return null;
  }

  const rawValue = decodeXmlEntities(valueMatch[1]);
  if (cellType === "s") {
    return sharedStrings[Number(rawValue)] ?? "";
  }
  if (cellType === "b") {
    return rawValue === "1";
  }
  if (cellType === "str") {
    return rawValue;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }
  return rawValue;
}

function extractInlineString(inner: string): string {
  const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  const parts: string[] = [];
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textPattern.exec(inner)) !== null) {
    parts.push(decodeXmlEntities(textMatch[1]));
  }
  return parts.join("");
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];
  const stringPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let stringMatch: RegExpExecArray | null;

  while ((stringMatch = stringPattern.exec(xml)) !== null) {
    values.push(extractInlineString(stringMatch[1]));
  }

  return values;
}

function unzipArchive(buffer: Uint8Array): Map<string, Buffer> {
  const source = Buffer.from(buffer);
  const eocdOffset = findEndOfCentralDirectory(source);
  const entryCount = source.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = source.readUInt32LE(eocdOffset + 16);
  const files = new Map<string, Buffer>();

  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (source.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Excelファイルの読み込みに失敗しました。");
    }

    const compressionMethod = source.readUInt16LE(offset + 10);
    const compressedSize = source.readUInt32LE(offset + 20);
    const fileNameLength = source.readUInt16LE(offset + 28);
    const extraFieldLength = source.readUInt16LE(offset + 30);
    const fileCommentLength = source.readUInt16LE(offset + 32);
    const localHeaderOffset = source.readUInt32LE(offset + 42);
    const fileName = source.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    const localNameLength = source.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = source.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = source.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (compressionMethod === 0) {
      fileData = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      fileData = Buffer.from(inflateRawSync(compressedData));
    } else {
      throw new Error("対応していないExcel圧縮形式です。");
    }

    files.set(fileName, fileData);
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return files;
}

function findEndOfCentralDirectory(source: Buffer): number {
  const minimumOffset = Math.max(0, source.length - 65_557);
  for (let index = source.length - 22; index >= minimumOffset; index -= 1) {
    if (source.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }
  throw new Error("Excelファイルの読み込みに失敗しました。");
}

function isZipBuffer(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

function excelSerialToIsoDate(serial: number, fieldLabel: string): string {
  if (!Number.isFinite(serial)) {
    throw new Error(`${fieldLabel}が不正です。`);
  }

  const milliseconds = Math.round((serial - 25_569) * 86_400_000);
  const date = new Date(milliseconds);
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), fieldLabel);
}

function formatIsoDate(year: number, month: number, day: number, fieldLabel: string): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldLabel}が不正です。`);
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function toTrimmedString(value: ParsedCell | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeHeader(value: ParsedCell | undefined): string {
  return toTrimmedString(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-/:]/g, "");
}

function columnLettersToIndex(value: string): number {
  let result = 0;
  for (const char of value.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
