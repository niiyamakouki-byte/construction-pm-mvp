#!/usr/bin/env -S node --experimental-strip-types
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFileApiStore = exports.InMemoryApiStore = exports.ApiError = void 0;
exports.parseMultipartBody = parseMultipartBody;
exports.handleApiRequest = handleApiRequest;
exports.createApiServer = createApiServer;
exports.startApiServer = startApiServer;
var node_http_1 = require("node:http");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var schedule_importer_js_1 = require("./schedule-importer.js");
var PROJECT_STATUSES = ["planning", "active", "completed"];
var TASK_STATUSES = ["todo", "in_progress", "done"];
var MATERIAL_STATUSES = ["ordered", "delivered", "installed"];
var CHANGE_ORDER_STATUSES = ["pending", "approved", "rejected"];
var DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"];
var DEFAULT_PORT = 3001;
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(statusCode, message) {
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        _this.name = "ApiError";
        return _this;
    }
    return ApiError;
}(Error));
exports.ApiError = ApiError;
function createEmptyState() {
    return {
        projects: [],
        tasks: [],
        contractors: [],
        materials: [],
        changeOrders: [],
    };
}
function clone(value) {
    return structuredClone(value);
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function parseDateString(value, fieldLabel) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306FYYYY-MM-DD\u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    var date = new Date("".concat(value, "T00:00:00.000Z"));
    if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
        throw new ApiError(400, "".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    return value;
}
function assertDateOrder(startDate, endDate) {
    if (startDate > endDate) {
        throw new ApiError(400, "開始日は終了日以前の日付を指定してください。");
    }
}
function validateEnum(value, allowed, fieldLabel) {
    if (typeof value !== "string" || !allowed.includes(value)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    return value;
}
function requireString(input, fieldName, fieldLabel, maxLength) {
    var value = input[fieldName];
    if (!isNonEmptyString(value)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F\u5FC5\u9808\u3067\u3059\u3002"));
    }
    var normalized = value.trim();
    if (normalized.length > maxLength) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F").concat(maxLength, "\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return normalized;
}
function optionalTrimmedString(input, fieldName, fieldLabel, maxLength) {
    var value = input[fieldName];
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F\u6587\u5B57\u5217\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    var normalized = value.trim();
    if (!normalized) {
        throw new ApiError(400, "".concat(fieldLabel, "\u3092\u7A7A\u6587\u5B57\u306B\u306F\u3067\u304D\u307E\u305B\u3093\u3002"));
    }
    if (normalized.length > maxLength) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F").concat(maxLength, "\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return normalized;
}
function optionalUpdatedString(input, fieldName, fieldLabel, maxLength, options) {
    if (options === void 0) { options = {}; }
    if (!(fieldName in input)) {
        return undefined;
    }
    var value = input[fieldName];
    if (typeof value !== "string") {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F\u6587\u5B57\u5217\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    var normalized = value.trim();
    if (!options.allowEmpty && !normalized) {
        throw new ApiError(400, "".concat(fieldLabel, "\u3092\u7A7A\u6587\u5B57\u306B\u306F\u3067\u304D\u307E\u305B\u3093\u3002"));
    }
    if (normalized.length > maxLength) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F").concat(maxLength, "\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return normalized;
}
function requireStringFromAliases(input, fieldNames, fieldLabel, maxLength) {
    for (var _i = 0, fieldNames_1 = fieldNames; _i < fieldNames_1.length; _i++) {
        var fieldName = fieldNames_1[_i];
        if (fieldName in input) {
            return requireString(input, fieldName, fieldLabel, maxLength);
        }
    }
    throw new ApiError(400, "".concat(fieldLabel, "\u306F\u5FC5\u9808\u3067\u3059\u3002"));
}
function parseNumericValue(value, fieldLabel, options) {
    if (options === void 0) { options = {}; }
    var parsed = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : Number.NaN;
    if (!Number.isFinite(parsed)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F\u6570\u5024\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    if (options.integer && !Number.isInteger(parsed)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    if (options.min !== undefined && parsed < options.min) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F").concat(options.min, "\u4EE5\u4E0A\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    if (options.max !== undefined && parsed > options.max) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306F").concat(options.max, "\u4EE5\u4E0B\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return parsed;
}
function optionalUpdatedNullableString(input, fieldName, fieldLabel, maxLength) {
    if (!(fieldName in input)) {
        return undefined;
    }
    if (input[fieldName] === null) {
        return null;
    }
    return optionalUpdatedString(input, fieldName, fieldLabel, maxLength);
}
function optionalUpdatedNumber(input, fieldName, fieldLabel, options) {
    if (options === void 0) { options = {}; }
    if (!(fieldName in input)) {
        return undefined;
    }
    return parseNumericValue(input[fieldName], fieldLabel, options);
}
function optionalUpdatedNullableNumber(input, fieldName, fieldLabel, options) {
    if (options === void 0) { options = {}; }
    if (!(fieldName in input)) {
        return undefined;
    }
    if (input[fieldName] === null) {
        return null;
    }
    return parseNumericValue(input[fieldName], fieldLabel, options);
}
function optionalDateString(input, fieldName, fieldLabel) {
    var value = input[fieldName];
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new ApiError(400, "".concat(fieldLabel, "\u306FYYYY-MM-DD\u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return parseDateString(value.trim(), fieldLabel);
}
function optionalUpdatedNullableDateString(input, fieldName, fieldLabel) {
    if (!(fieldName in input)) {
        return undefined;
    }
    if (input[fieldName] === null) {
        return null;
    }
    if (typeof input[fieldName] !== "string") {
        throw new ApiError(400, "".concat(fieldLabel, "\u306FYYYY-MM-DD\u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return parseDateString(input[fieldName].trim(), fieldLabel);
}
function optionalBoolean(input, fieldName, fieldLabel) {
    if (!(fieldName in input)) {
        return undefined;
    }
    if (typeof input[fieldName] !== "boolean") {
        throw new ApiError(400, "".concat(fieldLabel, "\u306Ftrue\u307E\u305F\u306Ffalse\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    }
    return input[fieldName];
}
function validateEmail(value, fieldLabel) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new ApiError(400, "".concat(fieldLabel, "\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059\u3002"));
    }
    return value;
}
function assertProjectStatusTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
        return;
    }
    var currentIndex = PROJECT_STATUSES.indexOf(currentStatus);
    var nextIndex = PROJECT_STATUSES.indexOf(nextStatus);
    if (nextIndex - currentIndex !== 1) {
        throw new ApiError(400, "プロジェクトステータスは planning → active → completed の順でのみ更新できます。");
    }
}
function validateCreateProjectInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    return {
        name: requireString(payload, "name", "プロジェクト名", 200),
        contractor: requireString(payload, "contractor", "元請会社名", 200),
        address: requireString(payload, "address", "住所", 500),
        status: validateEnum(payload.status, PROJECT_STATUSES, "ステータス"),
        clientId: optionalTrimmedString(payload, "clientId", "顧客ID", 200),
        clientName: optionalTrimmedString(payload, "clientName", "顧客名", 200),
        contractAmount: "contractAmount" in payload
            ? parseNumericValue(payload.contractAmount, "契約金額", { min: 0 })
            : undefined,
        contractDate: optionalDateString(payload, "contractDate", "契約日"),
        inspectionDate: optionalDateString(payload, "inspectionDate", "検査日"),
        handoverDate: optionalDateString(payload, "handoverDate", "引渡日"),
        warrantyEndDate: optionalDateString(payload, "warrantyEndDate", "保証終了日"),
    };
}
function validateUpdateProjectInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    var update = {};
    if ("name" in payload) {
        update.name = optionalUpdatedString(payload, "name", "プロジェクト名", 200);
    }
    if ("contractor" in payload) {
        update.contractor = optionalUpdatedString(payload, "contractor", "元請会社名", 200);
    }
    if ("address" in payload) {
        update.address = optionalUpdatedString(payload, "address", "住所", 500);
    }
    if ("status" in payload) {
        update.status = validateEnum(payload.status, PROJECT_STATUSES, "ステータス");
    }
    if ("description" in payload) {
        update.description = optionalUpdatedString(payload, "description", "説明", 2000, {
            allowEmpty: true,
        });
    }
    if ("startDate" in payload) {
        if (typeof payload.startDate !== "string") {
            throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
        }
        update.startDate = parseDateString(payload.startDate.trim(), "開始日");
    }
    if ("endDate" in payload) {
        if (payload.endDate === null) {
            update.endDate = null;
        }
        else if (typeof payload.endDate === "string") {
            update.endDate = parseDateString(payload.endDate.trim(), "終了日");
        }
        else {
            throw new ApiError(400, "終了日はYYYY-MM-DD形式で入力してください。");
        }
    }
    if ("clientId" in payload) {
        update.clientId = optionalUpdatedNullableString(payload, "clientId", "顧客ID", 200);
    }
    if ("clientName" in payload) {
        update.clientName = optionalUpdatedNullableString(payload, "clientName", "顧客名", 200);
    }
    if ("contractAmount" in payload) {
        update.contractAmount = optionalUpdatedNullableNumber(payload, "contractAmount", "契約金額", {
            min: 0,
        });
    }
    if ("contractDate" in payload) {
        update.contractDate = optionalUpdatedNullableDateString(payload, "contractDate", "契約日");
    }
    if ("inspectionDate" in payload) {
        update.inspectionDate = optionalUpdatedNullableDateString(payload, "inspectionDate", "検査日");
    }
    if ("handoverDate" in payload) {
        update.handoverDate = optionalUpdatedNullableDateString(payload, "handoverDate", "引渡日");
    }
    if ("warrantyEndDate" in payload) {
        update.warrantyEndDate = optionalUpdatedNullableDateString(payload, "warrantyEndDate", "保証終了日");
    }
    if (Object.keys(update).length === 0) {
        throw new ApiError(400, "更新対象の項目を指定してください。");
    }
    return update;
}
function validateCreateTaskInput(payload) {
    var _a;
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    var startDate = parseDateString(requireString(payload, "startDate", "開始日", 10), "開始日");
    var endDate = parseDateString(requireString(payload, "endDate", "終了日", 10), "終了日");
    assertDateOrder(startDate, endDate);
    var isMilestone = optionalBoolean(payload, "isMilestone", "マイルストーン");
    if (isMilestone && startDate !== endDate) {
        throw new ApiError(400, "マイルストーンは開始日と終了日を同日にしてください。");
    }
    return {
        name: requireString(payload, "name", "タスク名", 200),
        startDate: startDate,
        endDate: endDate,
        progress: "progress" in payload
            ? parseNumericValue(payload.progress, "進捗率", { min: 0, max: 100, integer: true })
            : undefined,
        cost: "cost" in payload
            ? parseNumericValue(payload.cost, "タスク原価", { min: 0 })
            : undefined,
        contractorId: optionalTrimmedString(payload, "contractorId", "業者ID", 200),
        description: (_a = optionalTrimmedString(payload, "description", "説明", 2000)) !== null && _a !== void 0 ? _a : "",
        isMilestone: isMilestone,
    };
}
function validateCreateContractorInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    return {
        name: requireString(payload, "name", "業者名", 200),
        trade: requireStringFromAliases(payload, ["trade", "職種"], "職種", 100),
        phone: requireString(payload, "phone", "電話番号", 50),
        email: validateEmail(requireString(payload, "email", "メールアドレス", 200), "メールアドレス"),
    };
}
function validateCreateMaterialInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    return {
        name: requireString(payload, "name", "資材名", 200),
        quantity: parseNumericValue(payload.quantity, "数量", { min: 0 }),
        unit: requireString(payload, "unit", "単位", 50),
        unitPrice: parseNumericValue(payload.unitPrice, "単価", { min: 0 }),
        supplier: requireString(payload, "supplier", "仕入先", 200),
        deliveryDate: parseDateString(requireString(payload, "deliveryDate", "納品日", 10), "納品日"),
        status: validateEnum(payload.status, MATERIAL_STATUSES, "資材ステータス"),
    };
}
function validateCreateChangeOrderInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    return {
        description: requireString(payload, "description", "変更内容", 2000),
        amount: parseNumericValue(payload.amount, "金額"),
        approvedBy: requireString(payload, "approvedBy", "承認者", 200),
        date: parseDateString(requireString(payload, "date", "日付", 10), "日付"),
        status: validateEnum(payload.status, CHANGE_ORDER_STATUSES, "変更指示ステータス"),
    };
}
function validateUpdateTaskInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    var update = {};
    if ("status" in payload) {
        update.status = validateEnum(payload.status, TASK_STATUSES, "ステータス");
    }
    if ("startDate" in payload) {
        if (payload.startDate === null) {
            update.startDate = null;
        }
        else if (typeof payload.startDate === "string") {
            update.startDate = parseDateString(payload.startDate.trim(), "開始日");
        }
        else {
            throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
        }
    }
    if ("endDate" in payload) {
        if (payload.endDate === null) {
            update.endDate = null;
        }
        else if (typeof payload.endDate === "string") {
            update.endDate = parseDateString(payload.endDate.trim(), "終了日");
        }
        else {
            throw new ApiError(400, "終了日はYYYY-MM-DD形式で入力してください。");
        }
    }
    if ("projectId" in payload) {
        update.projectId = optionalUpdatedString(payload, "projectId", "プロジェクトID", 200);
    }
    if ("contractorId" in payload) {
        update.contractorId = optionalUpdatedNullableString(payload, "contractorId", "業者ID", 200);
    }
    if ("progress" in payload) {
        update.progress = optionalUpdatedNumber(payload, "progress", "進捗率", {
            min: 0,
            max: 100,
            integer: true,
        });
    }
    if ("cost" in payload) {
        update.cost = optionalUpdatedNumber(payload, "cost", "タスク原価", {
            min: 0,
        });
    }
    if ("isMilestone" in payload) {
        update.isMilestone = optionalBoolean(payload, "isMilestone", "マイルストーン");
    }
    if (Object.keys(update).length === 0) {
        throw new ApiError(400, "更新対象の項目を指定してください。");
    }
    return update;
}
function validateCreateDependencyInput(payload) {
    if (!isObject(payload)) {
        throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
    }
    return {
        predecessorId: requireString(payload, "predecessorId", "先行タスクID", 200),
        type: validateEnum(payload.type, DEPENDENCY_TYPES, "依存関係タイプ"),
        lagDays: "lagDays" in payload
            ? parseNumericValue(payload.lagDays, "ラグ日数", { integer: true })
            : 0,
    };
}
function serializeProject(project, taskCount) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __assign({ id: project.id, createdAt: project.createdAt, updatedAt: project.updatedAt, name: project.name, contractor: project.contractor, address: project.address, status: project.status, description: project.description, startDate: project.startDate, endDate: (_a = project.endDate) !== null && _a !== void 0 ? _a : null, includeWeekends: project.includeWeekends, clientId: (_b = project.clientId) !== null && _b !== void 0 ? _b : null, clientName: (_c = project.clientName) !== null && _c !== void 0 ? _c : null, contractAmount: (_d = project.contractAmount) !== null && _d !== void 0 ? _d : null, contractDate: (_e = project.contractDate) !== null && _e !== void 0 ? _e : null, inspectionDate: (_f = project.inspectionDate) !== null && _f !== void 0 ? _f : null, handoverDate: (_g = project.handoverDate) !== null && _g !== void 0 ? _g : null, warrantyEndDate: (_h = project.warrantyEndDate) !== null && _h !== void 0 ? _h : null }, (taskCount !== undefined ? { taskCount: taskCount } : {}));
}
function serializeTask(task) {
    var _a, _b, _c, _d;
    return {
        id: task.id,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        projectId: task.projectId,
        name: task.name,
        description: task.description,
        status: task.status,
        startDate: (_a = task.startDate) !== null && _a !== void 0 ? _a : null,
        endDate: (_b = task.dueDate) !== null && _b !== void 0 ? _b : null,
        progress: task.progress,
        cost: task.cost,
        dependencies: task.dependencies,
        contractorId: (_c = task.contractorId) !== null && _c !== void 0 ? _c : null,
        contractor: (_d = task.contractor) !== null && _d !== void 0 ? _d : null,
        isMilestone: task.isMilestone,
    };
}
function serializeContractor(contractor) {
    return {
        id: contractor.id,
        createdAt: contractor.createdAt,
        updatedAt: contractor.updatedAt,
        name: contractor.name,
        trade: contractor.trade,
        phone: contractor.phone,
        email: contractor.email,
    };
}
function serializeMaterial(material) {
    return {
        id: material.id,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
        projectId: material.projectId,
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
        unitPrice: material.unitPrice,
        supplier: material.supplier,
        deliveryDate: material.deliveryDate,
        status: material.status,
        totalCost: material.quantity * material.unitPrice,
    };
}
function serializeChangeOrder(changeOrder) {
    return {
        id: changeOrder.id,
        createdAt: changeOrder.createdAt,
        updatedAt: changeOrder.updatedAt,
        projectId: changeOrder.projectId,
        description: changeOrder.description,
        amount: changeOrder.amount,
        approvedBy: changeOrder.approvedBy,
        date: changeOrder.date,
        status: changeOrder.status,
    };
}
function calculateProjectProgress(tasks) {
    if (tasks.length === 0) {
        return 0;
    }
    var totalProgress = tasks.reduce(function (sum, task) { return sum + task.progress; }, 0);
    return Math.round(totalProgress / tasks.length);
}
function calculateCostSummary(tasks, materials, changeOrders) {
    var taskCost = tasks.reduce(function (sum, task) { return sum + task.cost; }, 0);
    var materialCost = materials.reduce(function (sum, material) { return sum + material.quantity * material.unitPrice; }, 0);
    var approvedChangeOrderCost = changeOrders
        .filter(function (changeOrder) { return changeOrder.status === "approved"; })
        .reduce(function (sum, changeOrder) { return sum + changeOrder.amount; }, 0);
    var pendingChangeOrderCost = changeOrders
        .filter(function (changeOrder) { return changeOrder.status === "pending"; })
        .reduce(function (sum, changeOrder) { return sum + changeOrder.amount; }, 0);
    var rejectedChangeOrderCost = changeOrders
        .filter(function (changeOrder) { return changeOrder.status === "rejected"; })
        .reduce(function (sum, changeOrder) { return sum + changeOrder.amount; }, 0);
    return {
        taskCost: taskCost,
        materialCost: materialCost,
        approvedChangeOrderCost: approvedChangeOrderCost,
        pendingChangeOrderCost: pendingChangeOrderCost,
        rejectedChangeOrderCost: rejectedChangeOrderCost,
        totalCost: taskCost + materialCost + approvedChangeOrderCost,
    };
}
function normalizeDependencyRecord(value) {
    if (typeof value === "string" && value.trim()) {
        return {
            predecessorId: value.trim(),
            type: "FS",
            lagDays: 0,
        };
    }
    if (!isObject(value) || !isNonEmptyString(value.predecessorId)) {
        return null;
    }
    return {
        predecessorId: value.predecessorId.trim(),
        type: typeof value.type === "string" && DEPENDENCY_TYPES.includes(value.type)
            ? value.type
            : "FS",
        lagDays: typeof value.lagDays === "number" && Number.isInteger(value.lagDays)
            ? value.lagDays
            : 0,
    };
}
function normalizeProjectRecord(project) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return __assign(__assign({}, project), { description: (_a = project.description) !== null && _a !== void 0 ? _a : "", startDate: (_b = project.startDate) !== null && _b !== void 0 ? _b : formatDate(new Date((_c = project.createdAt) !== null && _c !== void 0 ? _c : Date.now())), includeWeekends: (_d = project.includeWeekends) !== null && _d !== void 0 ? _d : true, clientId: (_e = project.clientId) !== null && _e !== void 0 ? _e : undefined, clientName: (_f = project.clientName) !== null && _f !== void 0 ? _f : undefined, contractAmount: typeof project.contractAmount === "number" ? project.contractAmount : undefined, contractDate: (_g = project.contractDate) !== null && _g !== void 0 ? _g : undefined, inspectionDate: (_h = project.inspectionDate) !== null && _h !== void 0 ? _h : undefined, handoverDate: (_j = project.handoverDate) !== null && _j !== void 0 ? _j : undefined, warrantyEndDate: (_k = project.warrantyEndDate) !== null && _k !== void 0 ? _k : undefined });
}
function normalizeTaskRecord(task) {
    var _a, _b;
    return __assign(__assign({}, task), { description: (_a = task.description) !== null && _a !== void 0 ? _a : "", progress: typeof task.progress === "number" ? task.progress : 0, cost: typeof task.cost === "number" ? task.cost : 0, dependencies: Array.isArray(task.dependencies)
            ? task.dependencies
                .map(function (dependency) { return normalizeDependencyRecord(dependency); })
                .filter(function (dependency) { return dependency !== null; })
            : [], isMilestone: (_b = task.isMilestone) !== null && _b !== void 0 ? _b : false });
}
function normalizeState(parsed) {
    return {
        projects: Array.isArray(parsed.projects)
            ? parsed.projects.map(function (project) { return normalizeProjectRecord(project); })
            : [],
        tasks: Array.isArray(parsed.tasks)
            ? parsed.tasks.map(function (task) { return normalizeTaskRecord(task); })
            : [],
        contractors: Array.isArray(parsed.contractors)
            ? parsed.contractors.map(function (contractor) { return contractor; })
            : [],
        materials: Array.isArray(parsed.materials)
            ? parsed.materials.map(function (material) { return material; })
            : [],
        changeOrders: Array.isArray(parsed.changeOrders)
            ? parsed.changeOrders.map(function (changeOrder) { return changeOrder; })
            : [],
    };
}
var InMemoryApiStore = /** @class */ (function () {
    function InMemoryApiStore() {
        this.state = createEmptyState();
    }
    InMemoryApiStore.prototype.listProjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, clone(this.state.projects)];
            });
        });
    };
    InMemoryApiStore.prototype.getProject = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var project;
            return __generator(this, function (_a) {
                project = this.state.projects.find(function (item) { return item.id === id; });
                return [2 /*return*/, project ? clone(project) : null];
            });
        });
    };
    InMemoryApiStore.prototype.createProject = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, project;
            return __generator(this, function (_a) {
                now = new Date();
                project = {
                    id: crypto.randomUUID(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    name: input.name,
                    contractor: input.contractor,
                    address: input.address,
                    status: input.status,
                    description: "",
                    startDate: formatDate(now),
                    includeWeekends: true,
                    clientId: input.clientId,
                    clientName: input.clientName,
                    contractAmount: input.contractAmount,
                    contractDate: input.contractDate,
                    inspectionDate: input.inspectionDate,
                    handoverDate: input.handoverDate,
                    warrantyEndDate: input.warrantyEndDate,
                };
                this.state.projects.push(project);
                return [2 /*return*/, clone(project)];
            });
        });
    };
    InMemoryApiStore.prototype.updateProject = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var index, existing, updated;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                index = this.state.projects.findIndex(function (item) { return item.id === id; });
                if (index === -1) {
                    return [2 /*return*/, null];
                }
                existing = this.state.projects[index];
                updated = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, existing), { updatedAt: new Date().toISOString() }), (input.name !== undefined ? { name: input.name } : {})), (input.contractor !== undefined ? { contractor: input.contractor } : {})), (input.address !== undefined ? { address: input.address } : {})), (input.status !== undefined ? { status: input.status } : {})), (input.description !== undefined ? { description: input.description } : {})), (input.startDate !== undefined ? { startDate: input.startDate } : {})), (input.endDate !== undefined
                    ? { endDate: (_a = input.endDate) !== null && _a !== void 0 ? _a : undefined }
                    : {})), (input.clientId !== undefined ? { clientId: (_b = input.clientId) !== null && _b !== void 0 ? _b : undefined } : {})), (input.clientName !== undefined ? { clientName: (_c = input.clientName) !== null && _c !== void 0 ? _c : undefined } : {})), (input.contractAmount !== undefined
                    ? { contractAmount: (_d = input.contractAmount) !== null && _d !== void 0 ? _d : undefined }
                    : {})), (input.contractDate !== undefined
                    ? { contractDate: (_e = input.contractDate) !== null && _e !== void 0 ? _e : undefined }
                    : {})), (input.inspectionDate !== undefined
                    ? { inspectionDate: (_f = input.inspectionDate) !== null && _f !== void 0 ? _f : undefined }
                    : {})), (input.handoverDate !== undefined
                    ? { handoverDate: (_g = input.handoverDate) !== null && _g !== void 0 ? _g : undefined }
                    : {})), (input.warrantyEndDate !== undefined
                    ? { warrantyEndDate: (_h = input.warrantyEndDate) !== null && _h !== void 0 ? _h : undefined }
                    : {}));
                this.state.projects[index] = updated;
                return [2 /*return*/, clone(updated)];
            });
        });
    };
    InMemoryApiStore.prototype.deleteProject = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var previousLength;
            return __generator(this, function (_a) {
                previousLength = this.state.projects.length;
                this.state.projects = this.state.projects.filter(function (item) { return item.id !== id; });
                if (this.state.projects.length === previousLength) {
                    return [2 /*return*/, false];
                }
                this.state.tasks = this.state.tasks.filter(function (task) { return task.projectId !== id; });
                this.state.materials = this.state.materials.filter(function (material) { return material.projectId !== id; });
                this.state.changeOrders = this.state.changeOrders.filter(function (changeOrder) { return changeOrder.projectId !== id; });
                return [2 /*return*/, true];
            });
        });
    };
    InMemoryApiStore.prototype.listContractors = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, clone(this.state.contractors)];
            });
        });
    };
    InMemoryApiStore.prototype.getContractor = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var contractor;
            return __generator(this, function (_a) {
                contractor = this.state.contractors.find(function (item) { return item.id === id; });
                return [2 /*return*/, contractor ? clone(contractor) : null];
            });
        });
    };
    InMemoryApiStore.prototype.createContractor = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, contractor;
            return __generator(this, function (_a) {
                now = new Date();
                contractor = {
                    id: crypto.randomUUID(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    name: input.name,
                    trade: input.trade,
                    phone: input.phone,
                    email: input.email,
                };
                this.state.contractors.push(contractor);
                return [2 /*return*/, clone(contractor)];
            });
        });
    };
    InMemoryApiStore.prototype.listTasks = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, clone(this.state.tasks.filter(function (task) { return task.projectId === projectId; }))];
            });
        });
    };
    InMemoryApiStore.prototype.getTask = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var task;
            return __generator(this, function (_a) {
                task = this.state.tasks.find(function (item) { return item.id === id; });
                return [2 /*return*/, task ? clone(task) : null];
            });
        });
    };
    InMemoryApiStore.prototype.createTask = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, task;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                now = new Date();
                task = {
                    id: crypto.randomUUID(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    projectId: projectId,
                    name: input.name,
                    description: input.description,
                    status: "todo",
                    startDate: input.startDate,
                    dueDate: input.endDate,
                    progress: (_a = input.progress) !== null && _a !== void 0 ? _a : 0,
                    cost: (_b = input.cost) !== null && _b !== void 0 ? _b : 0,
                    dependencies: [],
                    contractorId: input.contractorId,
                    contractor: input.contractor,
                    isMilestone: (_c = input.isMilestone) !== null && _c !== void 0 ? _c : false,
                };
                this.state.tasks.push(task);
                return [2 /*return*/, clone(task)];
            });
        });
    };
    InMemoryApiStore.prototype.updateTask = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var index, existing, updated;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                index = this.state.tasks.findIndex(function (item) { return item.id === id; });
                if (index === -1) {
                    return [2 /*return*/, null];
                }
                existing = this.state.tasks[index];
                updated = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, existing), { updatedAt: new Date().toISOString() }), (input.status ? { status: input.status } : {})), (input.startDate !== undefined
                    ? { startDate: (_a = input.startDate) !== null && _a !== void 0 ? _a : undefined }
                    : {})), (input.endDate !== undefined
                    ? { dueDate: (_b = input.endDate) !== null && _b !== void 0 ? _b : undefined }
                    : {})), (input.projectId !== undefined ? { projectId: input.projectId } : {})), (input.contractorId !== undefined
                    ? { contractorId: (_c = input.contractorId) !== null && _c !== void 0 ? _c : undefined }
                    : {})), (input.contractor !== undefined
                    ? { contractor: (_d = input.contractor) !== null && _d !== void 0 ? _d : undefined }
                    : {})), (input.progress !== undefined ? { progress: input.progress } : {})), (input.cost !== undefined ? { cost: input.cost } : {})), (input.dependencies !== undefined ? { dependencies: input.dependencies } : {})), (input.isMilestone !== undefined ? { isMilestone: input.isMilestone } : {}));
                this.state.tasks[index] = updated;
                return [2 /*return*/, clone(updated)];
            });
        });
    };
    InMemoryApiStore.prototype.deleteTask = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var previousLength;
            return __generator(this, function (_a) {
                previousLength = this.state.tasks.length;
                this.state.tasks = this.state.tasks.filter(function (item) { return item.id !== id; });
                if (this.state.tasks.length !== previousLength) {
                    this.state.tasks = this.state.tasks.map(function (task) { return (__assign(__assign({}, task), { dependencies: task.dependencies.filter(function (dependency) { return dependency.predecessorId !== id; }) })); });
                }
                return [2 /*return*/, this.state.tasks.length !== previousLength];
            });
        });
    };
    InMemoryApiStore.prototype.listMaterials = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, clone(this.state.materials.filter(function (material) { return material.projectId === projectId; }))];
            });
        });
    };
    InMemoryApiStore.prototype.createMaterial = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, material;
            return __generator(this, function (_a) {
                now = new Date();
                material = {
                    id: crypto.randomUUID(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    projectId: projectId,
                    name: input.name,
                    quantity: input.quantity,
                    unit: input.unit,
                    unitPrice: input.unitPrice,
                    supplier: input.supplier,
                    deliveryDate: input.deliveryDate,
                    status: input.status,
                };
                this.state.materials.push(material);
                return [2 /*return*/, clone(material)];
            });
        });
    };
    InMemoryApiStore.prototype.listChangeOrders = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, clone(this.state.changeOrders.filter(function (changeOrder) { return changeOrder.projectId === projectId; }))];
            });
        });
    };
    InMemoryApiStore.prototype.createChangeOrder = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, changeOrder;
            return __generator(this, function (_a) {
                now = new Date();
                changeOrder = {
                    id: crypto.randomUUID(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    projectId: projectId,
                    description: input.description,
                    amount: input.amount,
                    approvedBy: input.approvedBy,
                    date: input.date,
                    status: input.status,
                };
                this.state.changeOrders.push(changeOrder);
                return [2 /*return*/, clone(changeOrder)];
            });
        });
    };
    return InMemoryApiStore;
}());
exports.InMemoryApiStore = InMemoryApiStore;
var JsonFileApiStore = /** @class */ (function () {
    function JsonFileApiStore(filePath) {
        this.filePath = filePath;
        this.operationQueue = Promise.resolve();
    }
    JsonFileApiStore.prototype.enqueue = function (operation) {
        var next = this.operationQueue.then(operation, operation);
        this.operationQueue = next.then(function () { return undefined; }, function () { return undefined; });
        return next;
    };
    JsonFileApiStore.prototype.readState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var raw, parsed, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.filePath, "utf8")];
                    case 1:
                        raw = _a.sent();
                        parsed = JSON.parse(raw);
                        return [2 /*return*/, normalizeState(parsed)];
                    case 2:
                        error_1 = _a.sent();
                        if (error_1.code === "ENOENT") {
                            return [2 /*return*/, createEmptyState()];
                        }
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    JsonFileApiStore.prototype.writeState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(this.filePath), { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(this.filePath, JSON.stringify(state, null, 2), "utf8")];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    JsonFileApiStore.prototype.listProjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = clone;
                                return [4 /*yield*/, this.readState()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).projects])];
                        }
                    }); }); })];
            });
        });
    };
    JsonFileApiStore.prototype.getProject = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var project;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    project = (_a.sent()).projects.find(function (item) { return item.id === id; });
                                    return [2 /*return*/, project ? clone(project) : null];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.createProject = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, now, project;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    now = new Date();
                                    project = {
                                        id: crypto.randomUUID(),
                                        createdAt: now.toISOString(),
                                        updatedAt: now.toISOString(),
                                        name: input.name,
                                        contractor: input.contractor,
                                        address: input.address,
                                        status: input.status,
                                        description: "",
                                        startDate: formatDate(now),
                                        includeWeekends: true,
                                        clientId: input.clientId,
                                        clientName: input.clientName,
                                        contractAmount: input.contractAmount,
                                        contractDate: input.contractDate,
                                        inspectionDate: input.inspectionDate,
                                        handoverDate: input.handoverDate,
                                        warrantyEndDate: input.warrantyEndDate,
                                    };
                                    state.projects.push(project);
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, clone(project)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.updateProject = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, index, existing, updated;
                        var _a, _b, _c, _d, _e, _f, _g, _h;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _j.sent();
                                    index = state.projects.findIndex(function (item) { return item.id === id; });
                                    if (index === -1) {
                                        return [2 /*return*/, null];
                                    }
                                    existing = state.projects[index];
                                    updated = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, existing), { updatedAt: new Date().toISOString() }), (input.name !== undefined ? { name: input.name } : {})), (input.contractor !== undefined ? { contractor: input.contractor } : {})), (input.address !== undefined ? { address: input.address } : {})), (input.status !== undefined ? { status: input.status } : {})), (input.description !== undefined ? { description: input.description } : {})), (input.startDate !== undefined ? { startDate: input.startDate } : {})), (input.endDate !== undefined
                                        ? { endDate: (_a = input.endDate) !== null && _a !== void 0 ? _a : undefined }
                                        : {})), (input.clientId !== undefined ? { clientId: (_b = input.clientId) !== null && _b !== void 0 ? _b : undefined } : {})), (input.clientName !== undefined ? { clientName: (_c = input.clientName) !== null && _c !== void 0 ? _c : undefined } : {})), (input.contractAmount !== undefined
                                        ? { contractAmount: (_d = input.contractAmount) !== null && _d !== void 0 ? _d : undefined }
                                        : {})), (input.contractDate !== undefined
                                        ? { contractDate: (_e = input.contractDate) !== null && _e !== void 0 ? _e : undefined }
                                        : {})), (input.inspectionDate !== undefined
                                        ? { inspectionDate: (_f = input.inspectionDate) !== null && _f !== void 0 ? _f : undefined }
                                        : {})), (input.handoverDate !== undefined
                                        ? { handoverDate: (_g = input.handoverDate) !== null && _g !== void 0 ? _g : undefined }
                                        : {})), (input.warrantyEndDate !== undefined
                                        ? { warrantyEndDate: (_h = input.warrantyEndDate) !== null && _h !== void 0 ? _h : undefined }
                                        : {}));
                                    state.projects[index] = updated;
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _j.sent();
                                    return [2 /*return*/, clone(updated)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.deleteProject = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, previousLength;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    previousLength = state.projects.length;
                                    state.projects = state.projects.filter(function (item) { return item.id !== id; });
                                    if (state.projects.length === previousLength) {
                                        return [2 /*return*/, false];
                                    }
                                    state.tasks = state.tasks.filter(function (task) { return task.projectId !== id; });
                                    state.materials = state.materials.filter(function (material) { return material.projectId !== id; });
                                    state.changeOrders = state.changeOrders.filter(function (changeOrder) { return changeOrder.projectId !== id; });
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, true];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.listContractors = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = clone;
                                return [4 /*yield*/, this.readState()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).contractors])];
                        }
                    }); }); })];
            });
        });
    };
    JsonFileApiStore.prototype.getContractor = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var contractor;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    contractor = (_a.sent()).contractors.find(function (item) { return item.id === id; });
                                    return [2 /*return*/, contractor ? clone(contractor) : null];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.createContractor = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, now, contractor;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    now = new Date();
                                    contractor = {
                                        id: crypto.randomUUID(),
                                        createdAt: now.toISOString(),
                                        updatedAt: now.toISOString(),
                                        name: input.name,
                                        trade: input.trade,
                                        phone: input.phone,
                                        email: input.email,
                                    };
                                    state.contractors.push(contractor);
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, clone(contractor)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.listTasks = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = clone;
                                return [4 /*yield*/, this.readState()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).tasks.filter(function (item) { return item.projectId === projectId; })])];
                        }
                    }); }); })];
            });
        });
    };
    JsonFileApiStore.prototype.getTask = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var task;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    task = (_a.sent()).tasks.find(function (item) { return item.id === id; });
                                    return [2 /*return*/, task ? clone(task) : null];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.createTask = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, now, task;
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _d.sent();
                                    now = new Date();
                                    task = {
                                        id: crypto.randomUUID(),
                                        createdAt: now.toISOString(),
                                        updatedAt: now.toISOString(),
                                        projectId: projectId,
                                        name: input.name,
                                        description: input.description,
                                        status: "todo",
                                        startDate: input.startDate,
                                        dueDate: input.endDate,
                                        progress: (_a = input.progress) !== null && _a !== void 0 ? _a : 0,
                                        cost: (_b = input.cost) !== null && _b !== void 0 ? _b : 0,
                                        dependencies: [],
                                        contractorId: input.contractorId,
                                        contractor: input.contractor,
                                        isMilestone: (_c = input.isMilestone) !== null && _c !== void 0 ? _c : false,
                                    };
                                    state.tasks.push(task);
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _d.sent();
                                    return [2 /*return*/, clone(task)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.updateTask = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, index, existing, updated;
                        var _a, _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _e.sent();
                                    index = state.tasks.findIndex(function (item) { return item.id === id; });
                                    if (index === -1) {
                                        return [2 /*return*/, null];
                                    }
                                    existing = state.tasks[index];
                                    updated = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, existing), { updatedAt: new Date().toISOString() }), (input.status ? { status: input.status } : {})), (input.startDate !== undefined
                                        ? { startDate: (_a = input.startDate) !== null && _a !== void 0 ? _a : undefined }
                                        : {})), (input.endDate !== undefined
                                        ? { dueDate: (_b = input.endDate) !== null && _b !== void 0 ? _b : undefined }
                                        : {})), (input.projectId !== undefined ? { projectId: input.projectId } : {})), (input.contractorId !== undefined
                                        ? { contractorId: (_c = input.contractorId) !== null && _c !== void 0 ? _c : undefined }
                                        : {})), (input.contractor !== undefined
                                        ? { contractor: (_d = input.contractor) !== null && _d !== void 0 ? _d : undefined }
                                        : {})), (input.progress !== undefined ? { progress: input.progress } : {})), (input.cost !== undefined ? { cost: input.cost } : {})), (input.dependencies !== undefined ? { dependencies: input.dependencies } : {})), (input.isMilestone !== undefined ? { isMilestone: input.isMilestone } : {}));
                                    state.tasks[index] = updated;
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _e.sent();
                                    return [2 /*return*/, clone(updated)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.deleteTask = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, previousLength;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    previousLength = state.tasks.length;
                                    state.tasks = state.tasks.filter(function (item) { return item.id !== id; });
                                    if (state.tasks.length === previousLength) {
                                        return [2 /*return*/, false];
                                    }
                                    state.tasks = state.tasks.map(function (task) { return (__assign(__assign({}, task), { dependencies: task.dependencies.filter(function (dependency) { return dependency.predecessorId !== id; }) })); });
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, true];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.listMaterials = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = clone;
                                return [4 /*yield*/, this.readState()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).materials.filter(function (item) { return item.projectId === projectId; })])];
                        }
                    }); }); })];
            });
        });
    };
    JsonFileApiStore.prototype.createMaterial = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, now, material;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    now = new Date();
                                    material = {
                                        id: crypto.randomUUID(),
                                        createdAt: now.toISOString(),
                                        updatedAt: now.toISOString(),
                                        projectId: projectId,
                                        name: input.name,
                                        quantity: input.quantity,
                                        unit: input.unit,
                                        unitPrice: input.unitPrice,
                                        supplier: input.supplier,
                                        deliveryDate: input.deliveryDate,
                                        status: input.status,
                                    };
                                    state.materials.push(material);
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, clone(material)];
                            }
                        });
                    }); })];
            });
        });
    };
    JsonFileApiStore.prototype.listChangeOrders = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = clone;
                                return [4 /*yield*/, this.readState()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).changeOrders.filter(function (item) { return item.projectId === projectId; })])];
                        }
                    }); }); })];
            });
        });
    };
    JsonFileApiStore.prototype.createChangeOrder = function (projectId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var state, now, changeOrder;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.readState()];
                                case 1:
                                    state = _a.sent();
                                    now = new Date();
                                    changeOrder = {
                                        id: crypto.randomUUID(),
                                        createdAt: now.toISOString(),
                                        updatedAt: now.toISOString(),
                                        projectId: projectId,
                                        description: input.description,
                                        amount: input.amount,
                                        approvedBy: input.approvedBy,
                                        date: input.date,
                                        status: input.status,
                                    };
                                    state.changeOrders.push(changeOrder);
                                    return [4 /*yield*/, this.writeState(state)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/, clone(changeOrder)];
                            }
                        });
                    }); })];
            });
        });
    };
    return JsonFileApiStore;
}());
exports.JsonFileApiStore = JsonFileApiStore;
function readRawBody(request) {
    return __awaiter(this, void 0, void 0, function () {
        var chunks, chunk, e_1_1;
        var _a, request_1, request_1_1;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    chunks = [];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, request_1 = __asyncValues(request);
                    _e.label = 2;
                case 2: return [4 /*yield*/, request_1.next()];
                case 3:
                    if (!(request_1_1 = _e.sent(), _b = request_1_1.done, !_b)) return [3 /*break*/, 5];
                    _d = request_1_1.value;
                    _a = false;
                    chunk = _d;
                    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = request_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(request_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12:
                    if (chunks.length === 0) {
                        return [2 /*return*/, Buffer.alloc(0)];
                    }
                    return [2 /*return*/, Buffer.concat(chunks)];
            }
        });
    });
}
function readJsonBody(request) {
    return __awaiter(this, void 0, void 0, function () {
        var rawBody;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readRawBody(request)];
                case 1:
                    rawBody = (_a.sent()).toString("utf8");
                    if (!rawBody) {
                        return [2 /*return*/, {}];
                    }
                    try {
                        return [2 /*return*/, JSON.parse(rawBody)];
                    }
                    catch (_b) {
                        throw new ApiError(400, "JSON形式のリクエストボディを送信してください。");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function readMultipartBody(request, contentType) {
    return __awaiter(this, void 0, void 0, function () {
        var boundaryMatch, boundary, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
                    boundary = (_b = boundaryMatch === null || boundaryMatch === void 0 ? void 0 : boundaryMatch[1]) !== null && _b !== void 0 ? _b : boundaryMatch === null || boundaryMatch === void 0 ? void 0 : boundaryMatch[2];
                    if (!boundary) {
                        throw new ApiError(400, "multipart/form-data のboundaryが不正です。");
                    }
                    _a = parseMultipartBody;
                    return [4 /*yield*/, readRawBody(request)];
                case 1: return [2 /*return*/, _a.apply(void 0, [_c.sent(), boundary])];
            }
        });
    });
}
function parseMultipartBody(body, boundary) {
    var _a;
    var boundaryBuffer = Buffer.from("--".concat(boundary));
    var headerSeparator = Buffer.from("\r\n\r\n");
    var fields = {};
    var files = [];
    var searchOffset = 0;
    while (searchOffset < body.length) {
        var boundaryIndex = body.indexOf(boundaryBuffer, searchOffset);
        if (boundaryIndex === -1) {
            break;
        }
        var cursor = boundaryIndex + boundaryBuffer.length;
        var isFinalBoundary = body[cursor] === 45 && body[cursor + 1] === 45;
        if (isFinalBoundary) {
            break;
        }
        if (body[cursor] === 13 && body[cursor + 1] === 10) {
            cursor += 2;
        }
        var headerEnd = body.indexOf(headerSeparator, cursor);
        if (headerEnd === -1) {
            throw new ApiError(400, "multipart/form-data のヘッダー解析に失敗しました。");
        }
        var headers = parseMultipartHeaders(body.toString("utf8", cursor, headerEnd));
        var contentStart = headerEnd + headerSeparator.length;
        var nextBoundaryIndex = body.indexOf(boundaryBuffer, contentStart);
        if (nextBoundaryIndex === -1) {
            throw new ApiError(400, "multipart/form-data の本文解析に失敗しました。");
        }
        var contentEnd = body[nextBoundaryIndex - 2] === 13 && body[nextBoundaryIndex - 1] === 10
            ? nextBoundaryIndex - 2
            : nextBoundaryIndex;
        var content = body.subarray(contentStart, contentEnd);
        var disposition = parseContentDisposition(headers["content-disposition"]);
        if (disposition.filename) {
            files.push({
                fieldName: disposition.name,
                filename: disposition.filename,
                contentType: (_a = headers["content-type"]) !== null && _a !== void 0 ? _a : "application/octet-stream",
                buffer: Buffer.from(content),
            });
        }
        else {
            fields[disposition.name] = content.toString("utf8");
        }
        searchOffset = nextBoundaryIndex;
    }
    return { fields: fields, files: files };
}
function parseMultipartHeaders(source) {
    var headers = {};
    for (var _i = 0, _a = source.split("\r\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        var separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
            continue;
        }
        var key = line.slice(0, separatorIndex).trim().toLowerCase();
        var value = line.slice(separatorIndex + 1).trim();
        headers[key] = value;
    }
    return headers;
}
function parseContentDisposition(value) {
    if (!value) {
        throw new ApiError(400, "multipart/form-data のContent-Dispositionが不足しています。");
    }
    var nameMatch = value.match(/\bname="([^"]+)"/i);
    if (!nameMatch) {
        throw new ApiError(400, "multipart/form-data のnameが不足しています。");
    }
    var filenameMatch = value.match(/\bfilename="([^"]*)"/i);
    return __assign({ name: nameMatch[1] }, ((filenameMatch === null || filenameMatch === void 0 ? void 0 : filenameMatch[1]) ? { filename: filenameMatch[1] } : {}));
}
function requireMultipartFile(payload) {
    if (!isObject(payload) || !Array.isArray(payload.files)) {
        throw new ApiError(400, "アップロードファイルを指定してください。");
    }
    var file = payload.files.find(function (item) {
        return isObject(item) &&
            typeof item.filename === "string" &&
            item.buffer instanceof Buffer;
    });
    if (!file) {
        throw new ApiError(400, "アップロードファイルを指定してください。");
    }
    return file;
}
function requireExistingProject(store, projectId) {
    return __awaiter(this, void 0, void 0, function () {
        var project;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, store.getProject(projectId)];
                case 1:
                    project = _a.sent();
                    if (!project) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    return [2 /*return*/, project];
            }
        });
    });
}
function readHeader(headers, name) {
    if (!headers) {
        return undefined;
    }
    var targetName = name.toLowerCase();
    for (var _i = 0, _a = Object.entries(headers); _i < _a.length; _i++) {
        var _b = _a[_i], headerName = _b[0], headerValue = _b[1];
        if (headerName.toLowerCase() !== targetName) {
            continue;
        }
        return Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }
    return undefined;
}
function requireApiKey(headers) {
    var expectedApiKey = process.env.API_KEY;
    if (!expectedApiKey) {
        throw new ApiError(500, "API_KEYが設定されていません。");
    }
    var providedApiKey = readHeader(headers, "x-api-key");
    if (providedApiKey !== expectedApiKey) {
        throw new ApiError(401, "APIキーが未設定、または不正です。");
    }
}
function resolveTaskContractor(store, contractorId) {
    return __awaiter(this, void 0, void 0, function () {
        var contractor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (contractorId === undefined) {
                        return [2 /*return*/, {}];
                    }
                    if (contractorId === null) {
                        return [2 /*return*/, { contractorId: null, contractor: null }];
                    }
                    return [4 /*yield*/, store.getContractor(contractorId)];
                case 1:
                    contractor = _a.sent();
                    if (!contractor) {
                        throw new ApiError(404, "指定された業者が見つかりません。");
                    }
                    return [2 /*return*/, {
                            contractorId: contractor.id,
                            contractor: contractor.name,
                        }];
            }
        });
    });
}
function sendJson(response, statusCode, body) {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(body));
}
function setCorsHeaders(response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}
function handleApiRequest(request, store) {
    return __awaiter(this, void 0, void 0, function () {
        var url, pathname, search_1, projects, serializedProjects, input, project, input, contractor, projectMatch, projectId, project, existing, input, nextStartDate, nextEndDate, project, deleted, projectTasksMatch, projectId, input, contractorLink, _a, task, projectMilestonesMatch, projectId, milestones, projectMaterialsMatch, projectId, input, material, projectChangesMatch, projectId, input, changeOrder, projectProgressMatch, projectId, tasks, projectCostSummaryMatch, projectId, _b, tasks, materials, changeOrders, projectImportMatch, projectId_1, uploadedFile, importedTasks, createdTasks, taskMatch, taskDependenciesMatch, taskId, task, dependency, predecessor, updatedTask, taskId, existing, input, _c, _d, _e, _f, nextStartDate, nextEndDate, nextIsMilestone, task, deleted;
        var _g, _h, _j, _k, _l, _m, _o, _p;
        var _this = this;
        var _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
        return __generator(this, function (_8) {
            switch (_8.label) {
                case 0:
                    url = new URL((_q = request.url) !== null && _q !== void 0 ? _q : "/", "http://127.0.0.1");
                    pathname = url.pathname;
                    if (request.method === "OPTIONS") {
                        return [2 /*return*/, { statusCode: 204 }];
                    }
                    if (request.method === "GET" && pathname === "/api/health") {
                        return [2 /*return*/, {
                                statusCode: 200,
                                body: { status: "ok" },
                            }];
                    }
                    requireApiKey(request.headers);
                    if (!(request.method === "GET" && pathname === "/api/projects")) return [3 /*break*/, 3];
                    search_1 = (_r = url.searchParams.get("search")) === null || _r === void 0 ? void 0 : _r.trim();
                    return [4 /*yield*/, store.listProjects()];
                case 1:
                    projects = (_8.sent()).filter(function (project) {
                        return search_1 ? project.name.includes(search_1) : true;
                    });
                    return [4 /*yield*/, Promise.all(projects.map(function (project) { return __awaiter(_this, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = serializeProject;
                                    _b = [project];
                                    return [4 /*yield*/, store.listTasks(project.id)];
                                case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([(_c.sent()).length]))];
                            }
                        }); }); }))];
                case 2:
                    serializedProjects = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: { projects: serializedProjects },
                        }];
                case 3:
                    if (!(request.method === "POST" && pathname === "/api/projects")) return [3 /*break*/, 5];
                    input = validateCreateProjectInput((_s = request.body) !== null && _s !== void 0 ? _s : {});
                    return [4 /*yield*/, store.createProject(input)];
                case 4:
                    project = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { project: serializeProject(project) },
                        }];
                case 5:
                    if (!(pathname === "/api/contractors")) return [3 /*break*/, 9];
                    if (!(request.method === "GET")) return [3 /*break*/, 7];
                    _g = {
                        statusCode: 200
                    };
                    _h = {};
                    return [4 /*yield*/, store.listContractors()];
                case 6: return [2 /*return*/, (_g.body = (_h.contractors = (_8.sent()).map(serializeContractor), _h),
                        _g)];
                case 7:
                    if (!(request.method === "POST")) return [3 /*break*/, 9];
                    input = validateCreateContractorInput((_t = request.body) !== null && _t !== void 0 ? _t : {});
                    return [4 /*yield*/, store.createContractor(input)];
                case 8:
                    contractor = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { contractor: serializeContractor(contractor) },
                        }];
                case 9:
                    projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
                    if (!projectMatch) return [3 /*break*/, 16];
                    projectId = decodeURIComponent(projectMatch[1]);
                    if (!(request.method === "GET")) return [3 /*break*/, 11];
                    return [4 /*yield*/, store.getProject(projectId)];
                case 10:
                    project = _8.sent();
                    if (!project) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: { project: serializeProject(project) },
                        }];
                case 11:
                    if (!(request.method === "PATCH")) return [3 /*break*/, 14];
                    return [4 /*yield*/, store.getProject(projectId)];
                case 12:
                    existing = _8.sent();
                    if (!existing) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    input = validateUpdateProjectInput((_u = request.body) !== null && _u !== void 0 ? _u : {});
                    if (input.status !== undefined) {
                        assertProjectStatusTransition(existing.status, input.status);
                    }
                    nextStartDate = (_v = input.startDate) !== null && _v !== void 0 ? _v : existing.startDate;
                    nextEndDate = input.endDate === undefined ? existing.endDate : ((_w = input.endDate) !== null && _w !== void 0 ? _w : undefined);
                    if (nextEndDate) {
                        assertDateOrder(nextStartDate, nextEndDate);
                    }
                    return [4 /*yield*/, store.updateProject(projectId, input)];
                case 13:
                    project = _8.sent();
                    if (!project) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: { project: serializeProject(project) },
                        }];
                case 14:
                    if (!(request.method === "DELETE")) return [3 /*break*/, 16];
                    return [4 /*yield*/, store.deleteProject(projectId)];
                case 15:
                    deleted = _8.sent();
                    if (!deleted) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    return [2 /*return*/, { statusCode: 204 }];
                case 16:
                    projectTasksMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
                    if (!projectTasksMatch) return [3 /*break*/, 24];
                    projectId = decodeURIComponent(projectTasksMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 17:
                    _8.sent();
                    if (!(request.method === "GET")) return [3 /*break*/, 19];
                    _j = {
                        statusCode: 200
                    };
                    _k = {};
                    return [4 /*yield*/, store.listTasks(projectId)];
                case 18: return [2 /*return*/, (_j.body = (_k.tasks = (_8.sent()).map(serializeTask), _k),
                        _j)];
                case 19:
                    if (!(request.method === "POST")) return [3 /*break*/, 24];
                    input = validateCreateTaskInput((_x = request.body) !== null && _x !== void 0 ? _x : {});
                    if (!(input.contractorId !== undefined)) return [3 /*break*/, 21];
                    return [4 /*yield*/, resolveTaskContractor(store, input.contractorId)];
                case 20:
                    _a = _8.sent();
                    return [3 /*break*/, 22];
                case 21:
                    _a = {};
                    _8.label = 22;
                case 22:
                    contractorLink = _a;
                    return [4 /*yield*/, store.createTask(projectId, __assign(__assign({}, input), { contractorId: (_y = contractorLink.contractorId) !== null && _y !== void 0 ? _y : input.contractorId, contractor: (_z = contractorLink.contractor) !== null && _z !== void 0 ? _z : input.contractor }))];
                case 23:
                    task = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { task: serializeTask(task) },
                        }];
                case 24:
                    projectMilestonesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/milestones$/);
                    if (!(request.method === "GET" && projectMilestonesMatch)) return [3 /*break*/, 27];
                    projectId = decodeURIComponent(projectMilestonesMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 25:
                    _8.sent();
                    return [4 /*yield*/, store.listTasks(projectId)];
                case 26:
                    milestones = (_8.sent())
                        .filter(function (task) { return task.isMilestone; })
                        .map(serializeTask);
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: { milestones: milestones },
                        }];
                case 27:
                    projectMaterialsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/materials$/);
                    if (!projectMaterialsMatch) return [3 /*break*/, 32];
                    projectId = decodeURIComponent(projectMaterialsMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 28:
                    _8.sent();
                    if (!(request.method === "GET")) return [3 /*break*/, 30];
                    _l = {
                        statusCode: 200
                    };
                    _m = {};
                    return [4 /*yield*/, store.listMaterials(projectId)];
                case 29: return [2 /*return*/, (_l.body = (_m.materials = (_8.sent()).map(serializeMaterial), _m),
                        _l)];
                case 30:
                    if (!(request.method === "POST")) return [3 /*break*/, 32];
                    input = validateCreateMaterialInput((_0 = request.body) !== null && _0 !== void 0 ? _0 : {});
                    return [4 /*yield*/, store.createMaterial(projectId, input)];
                case 31:
                    material = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { material: serializeMaterial(material) },
                        }];
                case 32:
                    projectChangesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
                    if (!projectChangesMatch) return [3 /*break*/, 37];
                    projectId = decodeURIComponent(projectChangesMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 33:
                    _8.sent();
                    if (!(request.method === "GET")) return [3 /*break*/, 35];
                    _o = {
                        statusCode: 200
                    };
                    _p = {};
                    return [4 /*yield*/, store.listChangeOrders(projectId)];
                case 34: return [2 /*return*/, (_o.body = (_p.changes = (_8.sent()).map(serializeChangeOrder), _p),
                        _o)];
                case 35:
                    if (!(request.method === "POST")) return [3 /*break*/, 37];
                    input = validateCreateChangeOrderInput((_1 = request.body) !== null && _1 !== void 0 ? _1 : {});
                    return [4 /*yield*/, store.createChangeOrder(projectId, input)];
                case 36:
                    changeOrder = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { change: serializeChangeOrder(changeOrder) },
                        }];
                case 37:
                    projectProgressMatch = pathname.match(/^\/api\/projects\/([^/]+)\/progress$/);
                    if (!(request.method === "GET" && projectProgressMatch)) return [3 /*break*/, 40];
                    projectId = decodeURIComponent(projectProgressMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 38:
                    _8.sent();
                    return [4 /*yield*/, store.listTasks(projectId)];
                case 39:
                    tasks = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: {
                                projectId: projectId,
                                overallProgress: calculateProjectProgress(tasks),
                                taskCount: tasks.length,
                            },
                        }];
                case 40:
                    projectCostSummaryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/cost-summary$/);
                    if (!(request.method === "GET" && projectCostSummaryMatch)) return [3 /*break*/, 43];
                    projectId = decodeURIComponent(projectCostSummaryMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId)];
                case 41:
                    _8.sent();
                    return [4 /*yield*/, Promise.all([
                            store.listTasks(projectId),
                            store.listMaterials(projectId),
                            store.listChangeOrders(projectId),
                        ])];
                case 42:
                    _b = _8.sent(), tasks = _b[0], materials = _b[1], changeOrders = _b[2];
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: __assign({ projectId: projectId }, calculateCostSummary(tasks, materials, changeOrders)),
                        }];
                case 43:
                    projectImportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/import$/);
                    if (!(request.method === "POST" && projectImportMatch)) return [3 /*break*/, 46];
                    projectId_1 = decodeURIComponent(projectImportMatch[1]);
                    return [4 /*yield*/, requireExistingProject(store, projectId_1)];
                case 44:
                    _8.sent();
                    uploadedFile = requireMultipartFile((_2 = request.body) !== null && _2 !== void 0 ? _2 : {});
                    importedTasks = (0, schedule_importer_js_1.parseScheduleImportFile)({
                        buffer: uploadedFile.buffer,
                        filename: uploadedFile.filename,
                    });
                    return [4 /*yield*/, Promise.all(importedTasks.map(function (task) {
                            var _a;
                            return store.createTask(projectId_1, {
                                name: task.name,
                                startDate: task.startDate,
                                endDate: task.endDate,
                                contractor: task.contractor,
                                description: (_a = task.description) !== null && _a !== void 0 ? _a : "",
                            });
                        }))];
                case 45:
                    createdTasks = _8.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: {
                                tasks: createdTasks.map(serializeTask),
                            },
                        }];
                case 46:
                    taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
                    taskDependenciesMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/dependencies$/);
                    if (!(request.method === "POST" && taskDependenciesMatch)) return [3 /*break*/, 50];
                    taskId = decodeURIComponent(taskDependenciesMatch[1]);
                    return [4 /*yield*/, store.getTask(taskId)];
                case 47:
                    task = _8.sent();
                    if (!task) {
                        throw new ApiError(404, "指定されたタスクが見つかりません。");
                    }
                    dependency = validateCreateDependencyInput((_3 = request.body) !== null && _3 !== void 0 ? _3 : {});
                    if (dependency.predecessorId === taskId) {
                        throw new ApiError(400, "タスク自身を依存先には設定できません。");
                    }
                    return [4 /*yield*/, store.getTask(dependency.predecessorId)];
                case 48:
                    predecessor = _8.sent();
                    if (!predecessor) {
                        throw new ApiError(404, "指定された依存先タスクが見つかりません。");
                    }
                    if (predecessor.projectId !== task.projectId) {
                        throw new ApiError(400, "依存関係は同一プロジェクト内のタスクにのみ設定できます。");
                    }
                    return [4 /*yield*/, store.updateTask(taskId, {
                            dependencies: __spreadArray(__spreadArray([], task.dependencies, true), [dependency], false),
                        })];
                case 49:
                    updatedTask = _8.sent();
                    if (!updatedTask) {
                        throw new ApiError(404, "指定されたタスクが見つかりません。");
                    }
                    return [2 /*return*/, {
                            statusCode: 201,
                            body: { task: serializeTask(updatedTask) },
                        }];
                case 50:
                    if (!taskMatch) return [3 /*break*/, 59];
                    taskId = decodeURIComponent(taskMatch[1]);
                    if (!(request.method === "PATCH")) return [3 /*break*/, 57];
                    return [4 /*yield*/, store.getTask(taskId)];
                case 51:
                    existing = _8.sent();
                    if (!existing) {
                        throw new ApiError(404, "指定されたタスクが見つかりません。");
                    }
                    input = validateUpdateTaskInput((_4 = request.body) !== null && _4 !== void 0 ? _4 : {});
                    _c = input.projectId !== undefined;
                    if (!_c) return [3 /*break*/, 53];
                    return [4 /*yield*/, store.getProject(input.projectId)];
                case 52:
                    _c = !(_8.sent());
                    _8.label = 53;
                case 53:
                    if (_c) {
                        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
                    }
                    if (!(input.contractorId !== undefined)) return [3 /*break*/, 55];
                    _e = (_d = Object).assign;
                    _f = [input];
                    return [4 /*yield*/, resolveTaskContractor(store, input.contractorId)];
                case 54:
                    _e.apply(_d, _f.concat([_8.sent()]));
                    _8.label = 55;
                case 55:
                    nextStartDate = input.startDate === undefined
                        ? existing.startDate
                        : ((_5 = input.startDate) !== null && _5 !== void 0 ? _5 : undefined);
                    nextEndDate = input.endDate === undefined
                        ? existing.dueDate
                        : ((_6 = input.endDate) !== null && _6 !== void 0 ? _6 : undefined);
                    nextIsMilestone = (_7 = input.isMilestone) !== null && _7 !== void 0 ? _7 : existing.isMilestone;
                    if (nextStartDate && nextEndDate) {
                        assertDateOrder(nextStartDate, nextEndDate);
                        if (nextIsMilestone && nextStartDate !== nextEndDate) {
                            throw new ApiError(400, "マイルストーンは開始日と終了日を同日にしてください。");
                        }
                    }
                    return [4 /*yield*/, store.updateTask(taskId, input)];
                case 56:
                    task = _8.sent();
                    if (!task) {
                        throw new ApiError(404, "指定されたタスクが見つかりません。");
                    }
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: { task: serializeTask(task) },
                        }];
                case 57:
                    if (!(request.method === "DELETE")) return [3 /*break*/, 59];
                    return [4 /*yield*/, store.deleteTask(taskId)];
                case 58:
                    deleted = _8.sent();
                    if (!deleted) {
                        throw new ApiError(404, "指定されたタスクが見つかりません。");
                    }
                    return [2 /*return*/, { statusCode: 204 }];
                case 59: throw new ApiError(404, "指定されたエンドポイントが見つかりません。");
            }
        });
    });
}
function handleRequest(request, response, store) {
    return __awaiter(this, void 0, void 0, function () {
        var shouldReadBody, contentType, result, _a, _b, _c;
        var _d;
        var _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    setCorsHeaders(response);
                    shouldReadBody = request.method === "POST" || request.method === "PATCH";
                    contentType = (_e = request.headers["content-type"]) !== null && _e !== void 0 ? _e : "";
                    _a = handleApiRequest;
                    _d = {
                        method: request.method,
                        url: request.url,
                        headers: request.headers
                    };
                    if (!shouldReadBody) return [3 /*break*/, 5];
                    if (!contentType.startsWith("multipart/form-data")) return [3 /*break*/, 2];
                    return [4 /*yield*/, readMultipartBody(request, contentType)];
                case 1:
                    _c = _g.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, readJsonBody(request)];
                case 3:
                    _c = _g.sent();
                    _g.label = 4;
                case 4:
                    _b = _c;
                    return [3 /*break*/, 6];
                case 5:
                    _b = undefined;
                    _g.label = 6;
                case 6: return [4 /*yield*/, _a.apply(void 0, [(_d.body = _b,
                            _d), store])];
                case 7:
                    result = _g.sent();
                    if (result.statusCode === 204) {
                        response.statusCode = 204;
                        response.end();
                        return [2 /*return*/];
                    }
                    sendJson(response, result.statusCode, (_f = result.body) !== null && _f !== void 0 ? _f : {});
                    return [2 /*return*/];
            }
        });
    });
}
function createApiServer(options) {
    var _this = this;
    var _a, _b, _c;
    if (options === void 0) { options = {}; }
    var store = (_a = options.store) !== null && _a !== void 0 ? _a : new JsonFileApiStore((_c = (_b = options.dataFilePath) !== null && _b !== void 0 ? _b : process.env.GENBAHUB_API_DB_FILE) !== null && _c !== void 0 ? _c : (0, node_path_1.resolve)(process.cwd(), ".genbahub-api-db.json"));
    return (0, node_http_1.createServer)(function (request, response) { return __awaiter(_this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, handleRequest(request, response, store)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    if (error_2 instanceof ApiError) {
                        sendJson(response, error_2.statusCode, { error: error_2.message });
                        return [2 /*return*/];
                    }
                    console.error(error_2);
                    sendJson(response, 500, { error: "サーバー内部でエラーが発生しました。" });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
function startApiServer(options) {
    var _a, _b;
    if (options === void 0) { options = {}; }
    var port = (_a = options.port) !== null && _a !== void 0 ? _a : Number((_b = process.env.PORT) !== null && _b !== void 0 ? _b : DEFAULT_PORT);
    var server = createApiServer(options);
    server.listen(port, function () {
        console.log("GenbaHub API server listening on http://127.0.0.1:".concat(port));
    });
    return server;
}
if (import.meta.url === new URL((_a = process.argv[1]) !== null && _a !== void 0 ? _a : "", "file:").href) {
    startApiServer();
}
