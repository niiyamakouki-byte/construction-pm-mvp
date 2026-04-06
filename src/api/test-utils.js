"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockXlsxBuffer = createMockXlsxBuffer;
var node_buffer_1 = require("node:buffer");
function createMockXlsxBuffer(rows) {
    var worksheetXml = buildWorksheetXml(rows);
    return createZipArchive([
        {
            name: "xl/worksheets/sheet1.xml",
            data: node_buffer_1.Buffer.from(worksheetXml, "utf8"),
        },
    ]);
}
function buildWorksheetXml(rows) {
    var body = rows
        .map(function (row, rowIndex) {
        var cells = row
            .map(function (value, columnIndex) {
            var ref = "".concat(toColumnName(columnIndex)).concat(rowIndex + 1);
            if (typeof value === "number") {
                return "<c r=\"".concat(ref, "\"><v>").concat(value, "</v></c>");
            }
            return "<c r=\"".concat(ref, "\" t=\"inlineStr\"><is><t>").concat(escapeXml(value), "</t></is></c>");
        })
            .join("");
        return "<row r=\"".concat(rowIndex + 1, "\">").concat(cells, "</row>");
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
function createZipArchive(entries) {
    var fileParts = [];
    var centralDirectoryParts = [];
    var offset = 0;
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        var fileName = node_buffer_1.Buffer.from(entry.name, "utf8");
        var header = node_buffer_1.Buffer.alloc(30);
        var crc32 = calculateCrc32(entry.data);
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
        var centralDirectory = node_buffer_1.Buffer.alloc(46);
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
    var centralDirectoryBuffer = node_buffer_1.Buffer.concat(centralDirectoryParts);
    var endOfCentralDirectory = node_buffer_1.Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);
    return node_buffer_1.Buffer.concat(__spreadArray(__spreadArray([], fileParts, true), [centralDirectoryBuffer, endOfCentralDirectory], false));
}
function toColumnName(index) {
    var columnNumber = index + 1;
    var columnName = "";
    while (columnNumber > 0) {
        var remainder = (columnNumber - 1) % 26;
        columnName = String.fromCharCode(65 + remainder) + columnName;
        columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return columnName;
}
function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
function calculateCrc32(buffer) {
    var crc = 0xffffffff;
    for (var _i = 0, buffer_1 = buffer; _i < buffer_1.length; _i++) {
        var byte = buffer_1[_i];
        crc ^= byte;
        for (var bit = 0; bit < 8; bit += 1) {
            var shouldXor = crc & 1;
            crc >>>= 1;
            if (shouldXor) {
                crc ^= 0xedb88320;
            }
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
