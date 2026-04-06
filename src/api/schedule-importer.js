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
exports.parseScheduleImportFile = parseScheduleImportFile;
exports.parseFlexibleScheduleDate = parseFlexibleScheduleDate;
var node_path_1 = require("node:path");
var node_zlib_1 = require("node:zlib");
var REQUIRED_COLUMN_KEYS = ["name", "startDate", "endDate"];
var HEADER_ALIASES = {
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
function parseScheduleImportFile(input) {
    var fileExtension = (0, node_path_1.extname)(input.filename).toLowerCase();
    var rows = parseRows(input.buffer, fileExtension);
    return mapRowsToTasks(rows);
}
function parseFlexibleScheduleDate(value, fieldLabel) {
    var _a;
    if (fieldLabel === void 0) { fieldLabel = "日付"; }
    if (value instanceof Date) {
        return formatIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), fieldLabel);
    }
    if (typeof value === "number") {
        return excelSerialToIsoDate(value, fieldLabel);
    }
    if (typeof value === "boolean" || value === null) {
        throw new Error("".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    var normalized = value.normalize("NFKC").trim();
    if (!normalized) {
        throw new Error("".concat(fieldLabel, "\u306F\u5FC5\u9808\u3067\u3059\u3002"));
    }
    var reiwaMatch = (_a = normalized.match(/^r\s*(\d{1,2})[./-](\d{1,2})[./-](\d{1,2})$/i)) !== null && _a !== void 0 ? _a : normalized.match(/^令和\s*(\d{1,2})年\s*(\d{1,2})月\s*(\d{1,2})日$/i);
    if (reiwaMatch) {
        var year = 2018 + Number(reiwaMatch[1]);
        return formatIsoDate(year, Number(reiwaMatch[2]), Number(reiwaMatch[3]), fieldLabel);
    }
    var slashMatch = normalized.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (slashMatch) {
        return formatIsoDate(Number(slashMatch[1]), Number(slashMatch[2]), Number(slashMatch[3]), fieldLabel);
    }
    var japaneseMatch = normalized.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/);
    if (japaneseMatch) {
        return formatIsoDate(Number(japaneseMatch[1]), Number(japaneseMatch[2]), Number(japaneseMatch[3]), fieldLabel);
    }
    throw new Error("".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
}
function parseRows(buffer, fileExtension) {
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
function mapRowsToTasks(rows) {
    var headerRowIndex = rows.findIndex(function (row) { return row.some(function (cell) { return toTrimmedString(cell).length > 0; }); });
    if (headerRowIndex === -1) {
        throw new Error("ヘッダー行が見つかりません。");
    }
    var mapping = detectColumnMapping(rows[headerRowIndex]);
    var tasks = [];
    for (var index = headerRowIndex + 1; index < rows.length; index += 1) {
        var row = rows[index];
        if (row.every(function (cell) { return toTrimmedString(cell).length === 0; })) {
            continue;
        }
        var rowNumber = index + 1;
        var name_1 = toTrimmedString(row[mapping.name]);
        if (!name_1) {
            throw new Error("".concat(rowNumber, "\u884C\u76EE\u306E\u30BF\u30B9\u30AF\u540D\u306F\u5FC5\u9808\u3067\u3059\u3002"));
        }
        var task = {
            name: name_1,
            startDate: parseFlexibleScheduleDate(row[mapping.startDate], "".concat(rowNumber, "\u884C\u76EE\u306E\u958B\u59CB\u65E5")),
            endDate: parseFlexibleScheduleDate(row[mapping.endDate], "".concat(rowNumber, "\u884C\u76EE\u306E\u7D42\u4E86\u65E5")),
        };
        if (task.startDate > task.endDate) {
            throw new Error("".concat(rowNumber, "\u884C\u76EE\u306E\u958B\u59CB\u65E5\u306F\u7D42\u4E86\u65E5\u4EE5\u524D\u306E\u65E5\u4ED8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
        }
        if (mapping.contractor !== undefined) {
            var contractor = toTrimmedString(row[mapping.contractor]);
            if (contractor) {
                task.contractor = contractor;
            }
        }
        if (mapping.description !== undefined) {
            var description = toTrimmedString(row[mapping.description]);
            if (description) {
                task.description = description;
            }
        }
        tasks.push(task);
    }
    return tasks;
}
function detectColumnMapping(headerRow) {
    var mapping = {};
    var _loop_1 = function (index) {
        var normalized = normalizeHeader(headerRow[index]);
        if (!normalized) {
            return "continue";
        }
        for (var _i = 0, _a = Object.entries(HEADER_ALIASES); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], aliases = _b[1];
            if (mapping[key] !== undefined) {
                continue;
            }
            if (aliases.some(function (alias) { return normalized === alias || normalized.includes(alias); })) {
                mapping[key] = index;
            }
        }
    };
    for (var index = 0; index < headerRow.length; index += 1) {
        _loop_1(index);
    }
    var missingColumns = REQUIRED_COLUMN_KEYS.filter(function (key) { return mapping[key] === undefined; });
    if (missingColumns.length > 0) {
        var labels = missingColumns.map(function (key) { return REQUIRED_COLUMN_LABELS[key]; }).join("、");
        throw new Error("\u5FC5\u9808\u5217\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059: ".concat(labels));
    }
    return mapping;
}
var REQUIRED_COLUMN_LABELS = {
    name: "タスク名",
    startDate: "開始日",
    endDate: "終了日",
};
function parseCsvRows(source) {
    var rows = [];
    var currentCell = "";
    var currentRow = [];
    var inQuotes = false;
    for (var index = 0; index < source.length; index += 1) {
        var char = source[index];
        var nextChar = source[index + 1];
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
function parseXlsxRows(buffer) {
    var files = unzipArchive(buffer);
    var sharedStringsXml = files.get("xl/sharedStrings.xml");
    var sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml.toString("utf8")) : [];
    var worksheetPath = __spreadArray([], files.keys(), true).filter(function (filePath) { return /^xl\/worksheets\/[^/]+\.xml$/i.test(filePath); })
        .sort()[0];
    if (!worksheetPath) {
        throw new Error("Excelワークシートが見つかりません。");
    }
    return parseWorksheetRows(files.get(worksheetPath).toString("utf8"), sharedStrings);
}
function parseSpreadsheetMlRows(xml) {
    var rows = [];
    var tableMatch = xml.match(/<Table\b[^>]*>([\s\S]*?)<\/Table>/i);
    if (!tableMatch) {
        throw new Error("Excelシートが見つかりません。");
    }
    var rowPattern = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
    var rowMatch;
    while ((rowMatch = rowPattern.exec(tableMatch[1])) !== null) {
        var row = [];
        var cellPattern = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gi;
        var cellMatch = void 0;
        while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
            var attrs = cellMatch[1];
            var cellIndexMatch = attrs.match(/(?:ss:Index|Index)="(\d+)"/i);
            if (cellIndexMatch) {
                var cellIndex = Number(cellIndexMatch[1]) - 1;
                while (row.length < cellIndex) {
                    row.push(null);
                }
            }
            var dataMatch = cellMatch[2].match(/<Data\b[^>]*?(?:ss:Type|Type)="([^"]+)"[^>]*>([\s\S]*?)<\/Data>/i);
            if (!dataMatch) {
                row.push(null);
                continue;
            }
            var rawValue = decodeXmlEntities(dataMatch[2]);
            var type = dataMatch[1].toLowerCase();
            row.push(type === "number" ? Number(rawValue) : rawValue);
        }
        rows.push(row);
    }
    return rows;
}
function parseWorksheetRows(xml, sharedStrings) {
    var _a;
    var rows = [];
    var rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    var rowMatch;
    while ((rowMatch = rowPattern.exec(xml)) !== null) {
        var row = [];
        var cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
        var cellMatch = void 0;
        while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
            var attrs = cellMatch[1];
            var inner = (_a = cellMatch[2]) !== null && _a !== void 0 ? _a : "";
            var refMatch = attrs.match(/\br="([A-Z]+)\d+"/i);
            var cellIndex = refMatch ? columnLettersToIndex(refMatch[1]) : row.length;
            while (row.length < cellIndex) {
                row.push(null);
            }
            row.push(parseWorksheetCellValue(attrs, inner, sharedStrings));
        }
        rows.push(row);
    }
    return rows;
}
function parseWorksheetCellValue(attrs, inner, sharedStrings) {
    var _a;
    var typeMatch = attrs.match(/\bt="([^"]+)"/i);
    var cellType = typeMatch === null || typeMatch === void 0 ? void 0 : typeMatch[1].toLowerCase();
    if (cellType === "inlinestr") {
        return extractInlineString(inner);
    }
    var valueMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
    if (!valueMatch) {
        return null;
    }
    var rawValue = decodeXmlEntities(valueMatch[1]);
    if (cellType === "s") {
        return (_a = sharedStrings[Number(rawValue)]) !== null && _a !== void 0 ? _a : "";
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
function extractInlineString(inner) {
    var textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    var parts = [];
    var textMatch;
    while ((textMatch = textPattern.exec(inner)) !== null) {
        parts.push(decodeXmlEntities(textMatch[1]));
    }
    return parts.join("");
}
function parseSharedStrings(xml) {
    var values = [];
    var stringPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    var stringMatch;
    while ((stringMatch = stringPattern.exec(xml)) !== null) {
        values.push(extractInlineString(stringMatch[1]));
    }
    return values;
}
function unzipArchive(buffer) {
    var source = Buffer.from(buffer);
    var eocdOffset = findEndOfCentralDirectory(source);
    var entryCount = source.readUInt16LE(eocdOffset + 10);
    var centralDirectoryOffset = source.readUInt32LE(eocdOffset + 16);
    var files = new Map();
    var offset = centralDirectoryOffset;
    for (var index = 0; index < entryCount; index += 1) {
        if (source.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error("Excelファイルの読み込みに失敗しました。");
        }
        var compressionMethod = source.readUInt16LE(offset + 10);
        var compressedSize = source.readUInt32LE(offset + 20);
        var fileNameLength = source.readUInt16LE(offset + 28);
        var extraFieldLength = source.readUInt16LE(offset + 30);
        var fileCommentLength = source.readUInt16LE(offset + 32);
        var localHeaderOffset = source.readUInt32LE(offset + 42);
        var fileName = source.toString("utf8", offset + 46, offset + 46 + fileNameLength);
        var localNameLength = source.readUInt16LE(localHeaderOffset + 26);
        var localExtraLength = source.readUInt16LE(localHeaderOffset + 28);
        var dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        var compressedData = source.subarray(dataStart, dataStart + compressedSize);
        var fileData = void 0;
        if (compressionMethod === 0) {
            fileData = Buffer.from(compressedData);
        }
        else if (compressionMethod === 8) {
            fileData = Buffer.from((0, node_zlib_1.inflateRawSync)(compressedData));
        }
        else {
            throw new Error("対応していないExcel圧縮形式です。");
        }
        files.set(fileName, fileData);
        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }
    return files;
}
function findEndOfCentralDirectory(source) {
    var minimumOffset = Math.max(0, source.length - 65557);
    for (var index = source.length - 22; index >= minimumOffset; index -= 1) {
        if (source.readUInt32LE(index) === 0x06054b50) {
            return index;
        }
    }
    throw new Error("Excelファイルの読み込みに失敗しました。");
}
function isZipBuffer(buffer) {
    return (buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
        (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08));
}
function excelSerialToIsoDate(serial, fieldLabel) {
    if (!Number.isFinite(serial)) {
        throw new Error("".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    var milliseconds = Math.round((serial - 25569) * 86400000);
    var date = new Date(milliseconds);
    return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), fieldLabel);
}
function formatIsoDate(year, month, day, fieldLabel) {
    var date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
        throw new Error("".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    return "".concat(year.toString().padStart(4, "0"), "-").concat(month.toString().padStart(2, "0"), "-").concat(day.toString().padStart(2, "0"));
}
function toTrimmedString(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).trim();
}
function normalizeHeader(value) {
    return toTrimmedString(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s_\-/:]/g, "");
}
function columnLettersToIndex(value) {
    var result = 0;
    for (var _i = 0, _a = value.toUpperCase(); _i < _a.length; _i++) {
        var char = _a[_i];
        result = result * 26 + (char.charCodeAt(0) - 64);
    }
    return result - 1;
}
function decodeXmlEntities(value) {
    return value
        .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCodePoint(Number.parseInt(hex, 16)); })
        .replace(/&#(\d+);/g, function (_, decimal) { return String.fromCodePoint(Number(decimal)); })
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}
