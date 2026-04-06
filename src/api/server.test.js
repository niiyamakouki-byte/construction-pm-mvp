"use strict";
/* @vitest-environment node */
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
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var server_js_1 = require("./server.js");
var test_utils_js_1 = require("./test-utils.js");
(0, vitest_1.describe)("GenbaHub API", function () {
    var TEST_API_KEY = "test-api-key";
    var store;
    (0, vitest_1.beforeEach)(function () {
        store = new server_js_1.InMemoryApiStore();
        process.env.API_KEY = TEST_API_KEY;
    });
    function request(method_1, url_1, body_1) {
        return __awaiter(this, arguments, void 0, function (method, url, body, headers) {
            var response, error_1;
            var _a;
            if (headers === void 0) { headers = { "x-api-key": TEST_API_KEY }; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, server_js_1.handleApiRequest)({ method: method, url: url, body: body, headers: headers }, store)];
                    case 1:
                        response = _b.sent();
                        return [2 /*return*/, {
                                status: response.statusCode,
                                body: (_a = response.body) !== null && _a !== void 0 ? _a : null,
                            }];
                    case 2:
                        error_1 = _b.sent();
                        if (error_1 instanceof server_js_1.ApiError) {
                            return [2 /*return*/, {
                                    status: error_1.statusCode,
                                    body: { error: error_1.message },
                                }];
                        }
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    (0, vitest_1.it)("GET /api/health はAPIキーなしで応答する", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("GET", "/api/health", undefined, {})];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 200,
                        body: { status: "ok" },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("保護されたエンドポイントはAPIキーがないと401を返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("GET", "/api/projects", undefined, {})];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 401,
                        body: { error: "APIキーが未設定、または不正です。" },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("保護されたエンドポイントは不正なAPIキーで401を返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("GET", "/api/projects", undefined, {
                        "x-api-key": "wrong-key",
                    })];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 401,
                        body: { error: "APIキーが未設定、または不正です。" },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/projects でプロジェクトを作成できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "ゴディバ銀座店",
                        contractor: "フィールドクラブ",
                        address: "東京都中央区",
                        status: "planning",
                        clientId: "client-001",
                        clientName: "株式会社サンプル",
                        contractAmount: 2500000,
                        contractDate: "2026-01-05",
                        inspectionDate: "2026-02-20",
                        handoverDate: "2026-02-28",
                        warrantyEndDate: "2027-02-28",
                    })];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(201);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        project: {
                            name: "ゴディバ銀座店",
                            contractor: "フィールドクラブ",
                            address: "東京都中央区",
                            status: "planning",
                            clientId: "client-001",
                            clientName: "株式会社サンプル",
                            contractAmount: 2500000,
                            contractDate: "2026-01-05",
                            inspectionDate: "2026-02-20",
                            handoverDate: "2026-02-28",
                            warrantyEndDate: "2027-02-28",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/projects は必須項目不足で日本語エラーを返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "",
                        contractor: "フィールドクラブ",
                        address: "東京都中央区",
                        status: "planning",
                    })];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(400);
                    (0, vitest_1.expect)(response.body).toEqual({
                        error: "プロジェクト名は必須です。",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects で一覧を取得できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件A",
                        contractor: "元請A",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "案件B",
                            contractor: "元請B",
                            address: "神奈川県",
                            status: "active",
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects")];
                case 3:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        projects: [
                            { name: "案件A", taskCount: 0 },
                            { name: "案件B", taskCount: 0 },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects?search=... でプロジェクト名の部分一致検索と taskCount を返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var godivaProject, otherProject, godivaProjectId, otherProjectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "ゴディバ銀座店",
                        contractor: "元請A",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    godivaProject = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "渋谷改修",
                            contractor: "元請B",
                            address: "東京都",
                            status: "active",
                        })];
                case 2:
                    otherProject = _a.sent();
                    godivaProjectId = godivaProject.body.project.id;
                    otherProjectId = otherProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(godivaProjectId, "/tasks"), {
                            name: "墨出し",
                            startDate: "2026-01-10",
                            endDate: "2026-01-11",
                            description: "",
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(godivaProjectId, "/tasks"), {
                            name: "LGS",
                            startDate: "2026-01-12",
                            endDate: "2026-01-13",
                            description: "",
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(otherProjectId, "/tasks"), {
                            name: "解体",
                            startDate: "2026-01-14",
                            endDate: "2026-01-15",
                            description: "",
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects?search=ゴディバ")];
                case 6:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toEqual({
                        projects: [
                            vitest_1.expect.objectContaining({
                                id: godivaProjectId,
                                name: "ゴディバ銀座店",
                                taskCount: 2,
                            }),
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects/:id で単一プロジェクトを取得できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var created, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件C",
                        contractor: "元請C",
                        address: "埼玉県",
                        status: "active",
                    })];
                case 1:
                    created = _a.sent();
                    projectId = created.body.project.id;
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId))];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        project: {
                            id: projectId,
                            name: "案件C",
                            contractor: "元請C",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("PATCH /api/projects/:id でプロジェクトを更新できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var created, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件C",
                        contractor: "元請C",
                        address: "埼玉県",
                        status: "planning",
                    })];
                case 1:
                    created = _a.sent();
                    projectId = created.body.project.id;
                    return [4 /*yield*/, request("PATCH", "/api/projects/".concat(projectId), {
                            name: "案件C改",
                            contractor: "元請C改",
                            address: "東京都港区",
                            status: "active",
                            description: "夜間施工あり",
                            startDate: "2026-03-01",
                            endDate: "2026-03-31",
                            clientName: "株式会社更新先",
                            contractAmount: 3300000,
                            contractDate: "2026-02-01",
                        })];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        project: {
                            id: projectId,
                            name: "案件C改",
                            contractor: "元請C改",
                            address: "東京都港区",
                            status: "active",
                            description: "夜間施工あり",
                            startDate: "2026-03-01",
                            endDate: "2026-03-31",
                            clientName: "株式会社更新先",
                            contractAmount: 3300000,
                            contractDate: "2026-02-01",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("PATCH /api/projects/:id は planning から completed へのスキップ更新を拒否する", function () { return __awaiter(void 0, void 0, void 0, function () {
        var created, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Lifecycle",
                        contractor: "元請Lifecycle",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    created = _a.sent();
                    projectId = created.body.project.id;
                    return [4 /*yield*/, request("PATCH", "/api/projects/".concat(projectId), {
                            status: "completed",
                        })];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 400,
                        body: {
                            error: "プロジェクトステータスは planning → active → completed の順でのみ更新できます。",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("DELETE /api/projects/:id で関連タスクごとプロジェクトを削除できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, keptProject, projectId, keptProjectId, deleteResponse, deletedProjectResponse, deletedProjectTasksResponse, keptProjectTasksResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "削除対象案件",
                        contractor: "元請削除",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "継続案件",
                            contractor: "元請継続",
                            address: "神奈川県",
                            status: "active",
                        })];
                case 2:
                    keptProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    keptProjectId = keptProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "削除されるタスク",
                            startDate: "2026-04-01",
                            endDate: "2026-04-02",
                            description: "",
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(keptProjectId, "/tasks"), {
                            name: "残るタスク",
                            startDate: "2026-04-03",
                            endDate: "2026-04-04",
                            description: "",
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, request("DELETE", "/api/projects/".concat(projectId))];
                case 5:
                    deleteResponse = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId))];
                case 6:
                    deletedProjectResponse = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/tasks"))];
                case 7:
                    deletedProjectTasksResponse = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(keptProjectId, "/tasks"))];
                case 8:
                    keptProjectTasksResponse = _a.sent();
                    (0, vitest_1.expect)(deleteResponse.status).toBe(204);
                    (0, vitest_1.expect)(deleteResponse.body).toBeNull();
                    (0, vitest_1.expect)(deletedProjectResponse).toEqual({
                        status: 404,
                        body: { error: "指定されたプロジェクトが見つかりません。" },
                    });
                    (0, vitest_1.expect)(deletedProjectTasksResponse).toEqual({
                        status: 404,
                        body: { error: "指定されたプロジェクトが見つかりません。" },
                    });
                    (0, vitest_1.expect)(keptProjectTasksResponse.body).toMatchObject({
                        tasks: [{ name: "残るタスク" }],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST/GET /api/contractors で業者台帳を登録・取得できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var created, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/contractors", {
                        name: "山田内装",
                        trade: "軽天・ボード",
                        phone: "03-1234-5678",
                        email: "yamada@example.com",
                    })];
                case 1:
                    created = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/contractors")];
                case 2:
                    list = _a.sent();
                    (0, vitest_1.expect)(created.status).toBe(201);
                    (0, vitest_1.expect)(created.body).toMatchObject({
                        contractor: {
                            name: "山田内装",
                            trade: "軽天・ボード",
                            phone: "03-1234-5678",
                            email: "yamada@example.com",
                        },
                    });
                    (0, vitest_1.expect)(list.status).toBe(200);
                    (0, vitest_1.expect)(list.body).toMatchObject({
                        contractors: [
                            {
                                name: "山田内装",
                                trade: "軽天・ボード",
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/projects/:id/tasks でタスクを作成できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdContractor, contractorId, createdProject, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/contractors", {
                        name: "鈴木設備",
                        trade: "設備",
                        phone: "03-9999-0000",
                        email: "suzuki@example.com",
                    })];
                case 1:
                    createdContractor = _a.sent();
                    contractorId = createdContractor.body.contractor.id;
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "案件D",
                            contractor: "元請D",
                            address: "千葉県",
                            status: "planning",
                        })];
                case 2:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "LGS工事",
                            startDate: "2026-04-10",
                            endDate: "2026-04-15",
                            contractorId: contractorId,
                            progress: 15,
                            cost: 120000,
                            description: "軽量下地の先行施工",
                        })];
                case 3:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(201);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        task: {
                            projectId: projectId,
                            name: "LGS工事",
                            startDate: "2026-04-10",
                            endDate: "2026-04-15",
                            progress: 15,
                            cost: 120000,
                            contractorId: contractorId,
                            contractor: "鈴木設備",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects/:id/tasks でタスク一覧を取得できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件E",
                        contractor: "元請E",
                        address: "茨城県",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "墨出し",
                            startDate: "2026-05-01",
                            endDate: "2026-05-02",
                            description: "",
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/tasks"))];
                case 3:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        tasks: [
                            {
                                name: "墨出し",
                                startDate: "2026-05-01",
                                endDate: "2026-05-02",
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/projects/:id/tasks はマイルストーン作成時に同日指定を要求する", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件MilestoneValidation",
                        contractor: "元請MilestoneValidation",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "引渡し",
                            startDate: "2026-05-10",
                            endDate: "2026-05-12",
                            isMilestone: true,
                            description: "",
                        })];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 400,
                        body: { error: "マイルストーンは開始日と終了日を同日にしてください。" },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects/:id/milestones でマイルストーンだけを取得できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, milestoneResponse, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Milestones",
                        contractor: "元請Milestones",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "引渡し",
                            startDate: "2026-05-20",
                            endDate: "2026-05-20",
                            isMilestone: true,
                            description: "",
                        })];
                case 2:
                    milestoneResponse = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "内装工事",
                            startDate: "2026-05-10",
                            endDate: "2026-05-15",
                            description: "",
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/milestones"))];
                case 4:
                    response = _a.sent();
                    (0, vitest_1.expect)(milestoneResponse.status).toBe(201);
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toEqual({
                        milestones: [
                            vitest_1.expect.objectContaining({
                                name: "引渡し",
                                startDate: "2026-05-20",
                                endDate: "2026-05-20",
                                isMilestone: true,
                            }),
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("PATCH /api/tasks/:id でステータスと日付を更新できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdContractor, contractorId, createdProject, projectId, createdTask, taskId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/contractors", {
                        name: "田中電気",
                        trade: "電気",
                        phone: "045-123-4567",
                        email: "tanaka@example.com",
                    })];
                case 1:
                    createdContractor = _a.sent();
                    contractorId = createdContractor.body.contractor.id;
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "案件F",
                            contractor: "元請F",
                            address: "群馬県",
                            status: "planning",
                        })];
                case 2:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "ボード張り",
                            startDate: "2026-06-01",
                            endDate: "2026-06-03",
                            description: "",
                        })];
                case 3:
                    createdTask = _a.sent();
                    taskId = createdTask.body.task.id;
                    return [4 /*yield*/, request("PATCH", "/api/tasks/".concat(taskId), {
                            status: "in_progress",
                            startDate: "2026-06-02",
                            endDate: "2026-06-04",
                            progress: 45,
                            cost: 180000,
                            contractorId: contractorId,
                        })];
                case 4:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        task: {
                            id: taskId,
                            status: "in_progress",
                            startDate: "2026-06-02",
                            endDate: "2026-06-04",
                            progress: 45,
                            cost: 180000,
                            contractorId: contractorId,
                            contractor: "田中電気",
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/tasks/:id/dependencies で依存関係を追加できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, predecessor, successor, predecessorId, successorId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Dependencies",
                        contractor: "元請Dependencies",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "墨出し",
                            startDate: "2026-06-01",
                            endDate: "2026-06-02",
                            description: "",
                        })];
                case 2:
                    predecessor = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "軽天",
                            startDate: "2026-06-03",
                            endDate: "2026-06-05",
                            description: "",
                        })];
                case 3:
                    successor = _a.sent();
                    predecessorId = predecessor.body.task.id;
                    successorId = successor.body.task.id;
                    return [4 /*yield*/, request("POST", "/api/tasks/".concat(successorId, "/dependencies"), {
                            predecessorId: predecessorId,
                            type: "FS",
                            lagDays: 2,
                        })];
                case 4:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(201);
                    (0, vitest_1.expect)(response.body).toEqual({
                        task: vitest_1.expect.objectContaining({
                            id: successorId,
                            dependencies: [
                                {
                                    predecessorId: predecessorId,
                                    type: "FS",
                                    lagDays: 2,
                                },
                            ],
                        }),
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/tasks/:id/dependencies は存在しない依存先を拒否する", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, successor, successorId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件DependencyValidation",
                        contractor: "元請DependencyValidation",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "後続",
                            startDate: "2026-06-10",
                            endDate: "2026-06-12",
                            description: "",
                        })];
                case 2:
                    successor = _a.sent();
                    successorId = successor.body.task.id;
                    return [4 /*yield*/, request("POST", "/api/tasks/".concat(successorId, "/dependencies"), {
                            predecessorId: "missing-task",
                            type: "FS",
                            lagDays: 0,
                        })];
                case 3:
                    response = _a.sent();
                    (0, vitest_1.expect)(response).toEqual({
                        status: 404,
                        body: { error: "指定された依存先タスクが見つかりません。" },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST /api/projects/:id/tasks は未登録業者の contractorId を拒否する", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件F-2",
                        contractor: "元請F-2",
                        address: "群馬県",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "配線",
                            startDate: "2026-06-05",
                            endDate: "2026-06-06",
                            contractorId: "missing-contractor",
                            description: "",
                        })];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(404);
                    (0, vitest_1.expect)(response.body).toEqual({
                        error: "指定された業者が見つかりません。",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST/GET /api/projects/:id/materials で資材を管理できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, createdMaterial, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Materials",
                        contractor: "元請Materials",
                        address: "東京都",
                        status: "active",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/materials"), {
                            name: "石膏ボード",
                            quantity: 120,
                            unit: "枚",
                            unitPrice: 980,
                            supplier: "建材商事",
                            deliveryDate: "2026-06-20",
                            status: "ordered",
                        })];
                case 2:
                    createdMaterial = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/materials"))];
                case 3:
                    list = _a.sent();
                    (0, vitest_1.expect)(createdMaterial.status).toBe(201);
                    (0, vitest_1.expect)(createdMaterial.body).toMatchObject({
                        material: {
                            projectId: projectId,
                            name: "石膏ボード",
                            quantity: 120,
                            unit: "枚",
                            unitPrice: 980,
                            supplier: "建材商事",
                            deliveryDate: "2026-06-20",
                            status: "ordered",
                            totalCost: 117600,
                        },
                    });
                    (0, vitest_1.expect)(list.status).toBe(200);
                    (0, vitest_1.expect)(list.body).toMatchObject({
                        materials: [
                            {
                                name: "石膏ボード",
                                totalCost: 117600,
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("POST/GET /api/projects/:id/changes で変更指示を管理できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, createdChange, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Changes",
                        contractor: "元請Changes",
                        address: "東京都",
                        status: "active",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/changes"), {
                            description: "厨房区画の追加下地",
                            amount: 250000,
                            approvedBy: "現場代理人 佐藤",
                            date: "2026-06-18",
                            status: "approved",
                        })];
                case 2:
                    createdChange = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/changes"))];
                case 3:
                    list = _a.sent();
                    (0, vitest_1.expect)(createdChange.status).toBe(201);
                    (0, vitest_1.expect)(createdChange.body).toMatchObject({
                        change: {
                            projectId: projectId,
                            description: "厨房区画の追加下地",
                            amount: 250000,
                            approvedBy: "現場代理人 佐藤",
                            date: "2026-06-18",
                            status: "approved",
                        },
                    });
                    (0, vitest_1.expect)(list.status).toBe(200);
                    (0, vitest_1.expect)(list.body).toMatchObject({
                        changes: [
                            {
                                description: "厨房区画の追加下地",
                                amount: 250000,
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects/:id/progress でタスク進捗から全体進捗を返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, taskA, taskB, taskC, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Progress",
                        contractor: "元請Progress",
                        address: "千葉県",
                        status: "active",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "墨出し",
                            startDate: "2026-07-01",
                            endDate: "2026-07-02",
                            progress: 0,
                            description: "",
                        })];
                case 2:
                    taskA = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "軽天",
                            startDate: "2026-07-03",
                            endDate: "2026-07-04",
                            progress: 60,
                            description: "",
                        })];
                case 3:
                    taskB = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "ボード",
                            startDate: "2026-07-05",
                            endDate: "2026-07-06",
                            progress: 100,
                            description: "",
                        })];
                case 4:
                    taskC = _a.sent();
                    (0, vitest_1.expect)(taskA.status).toBe(201);
                    (0, vitest_1.expect)(taskB.status).toBe(201);
                    (0, vitest_1.expect)(taskC.status).toBe(201);
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/progress"))];
                case 5:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toEqual({
                        projectId: projectId,
                        overallProgress: 53,
                        taskCount: 3,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("GET /api/projects/:id/cost-summary でタスク・資材・変更指示の原価を集計できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Cost",
                        contractor: "元請Cost",
                        address: "埼玉県",
                        status: "active",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "解体",
                            startDate: "2026-08-01",
                            endDate: "2026-08-02",
                            cost: 300000,
                            description: "",
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "LGS",
                            startDate: "2026-08-03",
                            endDate: "2026-08-05",
                            cost: 450000,
                            description: "",
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/materials"), {
                            name: "スタッド",
                            quantity: 200,
                            unit: "本",
                            unitPrice: 850,
                            supplier: "建材センター",
                            deliveryDate: "2026-08-02",
                            status: "delivered",
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/changes"), {
                            description: "追加下地補強",
                            amount: 120000,
                            approvedBy: "工事部長",
                            date: "2026-08-04",
                            status: "approved",
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/changes"), {
                            description: "見切り変更",
                            amount: 50000,
                            approvedBy: "工事部長",
                            date: "2026-08-05",
                            status: "pending",
                        })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/changes"), {
                            description: "減額調整",
                            amount: -20000,
                            approvedBy: "工事部長",
                            date: "2026-08-06",
                            status: "rejected",
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/cost-summary"))];
                case 8:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toEqual({
                        projectId: projectId,
                        taskCost: 750000,
                        materialCost: 170000,
                        approvedChangeOrderCost: 120000,
                        pendingChangeOrderCost: 50000,
                        rejectedChangeOrderCost: -20000,
                        totalCost: 1040000,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("PATCH /api/tasks/:id で projectId を変更して別プロジェクトへ移動できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var fromProject, toProject, fromProjectId, toProjectId, createdTask, taskId, response, fromTasksResponse, toTasksResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "移動元案件",
                        contractor: "元請元",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    fromProject = _a.sent();
                    return [4 /*yield*/, request("POST", "/api/projects", {
                            name: "移動先案件",
                            contractor: "元請先",
                            address: "神奈川県",
                            status: "active",
                        })];
                case 2:
                    toProject = _a.sent();
                    fromProjectId = fromProject.body.project.id;
                    toProjectId = toProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(fromProjectId, "/tasks"), {
                            name: "移動タスク",
                            startDate: "2026-06-10",
                            endDate: "2026-06-12",
                            description: "",
                        })];
                case 3:
                    createdTask = _a.sent();
                    taskId = createdTask.body.task.id;
                    return [4 /*yield*/, request("PATCH", "/api/tasks/".concat(taskId), {
                            projectId: toProjectId,
                        })];
                case 4:
                    response = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(fromProjectId, "/tasks"))];
                case 5:
                    fromTasksResponse = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(toProjectId, "/tasks"))];
                case 6:
                    toTasksResponse = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(200);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        task: {
                            id: taskId,
                            projectId: toProjectId,
                            name: "移動タスク",
                        },
                    });
                    (0, vitest_1.expect)(fromTasksResponse.body).toEqual({ tasks: [] });
                    (0, vitest_1.expect)(toTasksResponse.body).toMatchObject({
                        tasks: [{ id: taskId, name: "移動タスク" }],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("multipart/form-data のファイルを解析できる", function () {
        var boundary = "----genbahub-boundary";
        var workbook = (0, test_utils_js_1.createMockXlsxBuffer)([
            ["作業名", "開始日", "完了日"],
            ["軽量下地", "R8.4.10", "2026年4月12日"],
        ]);
        var body = Buffer.concat([
            Buffer.from("--".concat(boundary, "\r\n")),
            Buffer.from("Content-Disposition: form-data; name=\"file\"; filename=\"schedule.xlsx\"\r\n"),
            Buffer.from("Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"),
            workbook,
            Buffer.from("\r\n--".concat(boundary, "--\r\n")),
        ]);
        var parsed = (0, server_js_1.parseMultipartBody)(body, boundary);
        (0, vitest_1.expect)(parsed.files).toHaveLength(1);
        (0, vitest_1.expect)(parsed.files[0]).toMatchObject({
            fieldName: "file",
            filename: "schedule.xlsx",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        (0, vitest_1.expect)(Buffer.compare(parsed.files[0].buffer, workbook)).toBe(0);
    });
    (0, vitest_1.it)("POST /api/projects/:id/import で工程表を取り込める", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, response, listResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件Import",
                        contractor: "元請Import",
                        address: "東京都",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/import"), {
                            files: [
                                {
                                    fieldName: "file",
                                    filename: "schedule.xlsx",
                                    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                    buffer: (0, test_utils_js_1.createMockXlsxBuffer)([
                                        ["作業名", "開始日", "完了日", "業者", "備考"],
                                        ["軽量下地", "R8.4.10", "2026年4月12日", "山田内装", "先行施工"],
                                    ]),
                                },
                            ],
                            fields: {},
                        })];
                case 2:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(201);
                    (0, vitest_1.expect)(response.body).toMatchObject({
                        tasks: [
                            {
                                projectId: projectId,
                                name: "軽量下地",
                                startDate: "2026-04-10",
                                endDate: "2026-04-12",
                                contractor: "山田内装",
                                description: "先行施工",
                            },
                        ],
                    });
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/tasks"))];
                case 3:
                    listResponse = _a.sent();
                    (0, vitest_1.expect)(listResponse.body).toMatchObject({
                        tasks: [
                            {
                                name: "軽量下地",
                                startDate: "2026-04-10",
                                endDate: "2026-04-12",
                                contractor: "山田内装",
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("DELETE /api/tasks/:id でタスクを削除できる", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createdProject, projectId, createdTask, taskId, deleteResponse, listResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("POST", "/api/projects", {
                        name: "案件G",
                        contractor: "元請G",
                        address: "栃木県",
                        status: "planning",
                    })];
                case 1:
                    createdProject = _a.sent();
                    projectId = createdProject.body.project.id;
                    return [4 /*yield*/, request("POST", "/api/projects/".concat(projectId, "/tasks"), {
                            name: "検査",
                            startDate: "2026-07-01",
                            endDate: "2026-07-01",
                            description: "",
                        })];
                case 2:
                    createdTask = _a.sent();
                    taskId = createdTask.body.task.id;
                    return [4 /*yield*/, request("DELETE", "/api/tasks/".concat(taskId))];
                case 3:
                    deleteResponse = _a.sent();
                    return [4 /*yield*/, request("GET", "/api/projects/".concat(projectId, "/tasks"))];
                case 4:
                    listResponse = _a.sent();
                    (0, vitest_1.expect)(deleteResponse.status).toBe(204);
                    (0, vitest_1.expect)(deleteResponse.body).toBeNull();
                    (0, vitest_1.expect)(listResponse.body).toEqual({ tasks: [] });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("存在しないタスク更新では404を返す", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request("PATCH", "/api/tasks/missing-task", {
                        status: "done",
                    })];
                case 1:
                    response = _a.sent();
                    (0, vitest_1.expect)(response.status).toBe(404);
                    (0, vitest_1.expect)(response.body).toEqual({
                        error: "指定されたタスクが見つかりません。",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
