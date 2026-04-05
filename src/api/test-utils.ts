import { Buffer } from "node:buffer";

export function createMockXlsxBuffer(rows: Array<Array<string | number>>): Buffer {
  const worksheetXml = buildWorksheetXml(rows);
  return createZipArchive([
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from(worksheetXml, "utf8"),
    },
  ]);
}

function buildWorksheetXml(rows: Array<Array<string | number>>): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${toColumnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === "number") {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">",
    "<sheetData>",
    body,
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

function createZipArchive(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const fileParts: Buffer[] = [];
  const centralDirectoryParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, "utf8");
    const header = Buffer.alloc(30);
    const crc32 = calculateCrc32(entry.data);

    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc32, 14);
    header.writeUInt32LE(entry.data.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    header.writeUInt16LE(0, 28);

    fileParts.push(header, fileName, entry.data);

    const centralDirectory = Buffer.alloc(46);
    centralDirectory.writeUInt32LE(0x02014b50, 0);
    centralDirectory.writeUInt16LE(20, 4);
    centralDirectory.writeUInt16LE(20, 6);
    centralDirectory.writeUInt16LE(0, 8);
    centralDirectory.writeUInt16LE(0, 10);
    centralDirectory.writeUInt16LE(0, 12);
    centralDirectory.writeUInt16LE(0, 14);
    centralDirectory.writeUInt32LE(crc32, 16);
    centralDirectory.writeUInt32LE(entry.data.length, 20);
    centralDirectory.writeUInt32LE(entry.data.length, 24);
    centralDirectory.writeUInt16LE(fileName.length, 28);
    centralDirectory.writeUInt16LE(0, 30);
    centralDirectory.writeUInt16LE(0, 32);
    centralDirectory.writeUInt16LE(0, 34);
    centralDirectory.writeUInt16LE(0, 36);
    centralDirectory.writeUInt32LE(0, 38);
    centralDirectory.writeUInt32LE(offset, 42);

    centralDirectoryParts.push(centralDirectory, fileName);
    offset += header.length + fileName.length + entry.data.length;
  }

  const centralDirectoryBuffer = Buffer.concat(centralDirectoryParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectoryBuffer, endOfCentralDirectory]);
}

function toColumnName(index: number): string {
  let columnNumber = index + 1;
  let columnName = "";

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return columnName;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function calculateCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const shouldXor = crc & 1;
      crc >>>= 1;
      if (shouldXor) {
        crc ^= 0xedb88320;
      }
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
