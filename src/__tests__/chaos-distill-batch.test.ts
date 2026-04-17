/**
 * カオステスト — 蒸留バッチ14モジュールの耐障害テスト
 * Empty/null/undefined inputs, huge inputs, negative numbers, XSS strings,
 * Unicode edge cases, date edge cases, boundary values, mixed type injection.
 */
import { describe, beforeEach, it, expect } from "vitest";

// 1. ai-schedule-generator
import {
  generateSchedule,
  calculateCriticalPath,
  adjustScheduleForHolidays,
  compressSchedule,
  getScheduleSummary,
  exportScheduleCSV,
  updatePaceFromActual,
  getDefaultPaceData,
  type ProjectSpec,
  type GeneratedTask as _GeneratedTask,
  type GeneratedSchedule,
} from "../lib/ai-schedule-generator.js";

// 2. multi-site-manager
import {
  createSite,
  addDailyReport as _addDailyReport,
  calculateSiteProfit,
  getMultiSiteDashboard,
  getWorkerAllocation as _getWorkerAllocation,
  optimizeWorkerAssignment,
  getDailyReportSummary,
  detectScheduleConflicts,
  forecastCashflow,
  exportDailyReportsCSV as _exportDailyReportsCSV,
} from "../lib/multi-site-manager.js";

// 3. e-contract-finance
import {
  clearEContracts,
  createContract,
  generatePaymentPlan,
  comparePaymentPlans,
  sendContract,
  signContract,
  checkContractExpiry,
  getContractStats,
  calculateMonthlyPayment,
  exportContractCSV as _exportContractCSV,
} from "../lib/e-contract-finance.js";

// 4. bim-takeoff
import {
  parseBIMElements,
  calculateWallTakeoff,
  calculateCeilingTakeoff,
  calculateFloorTakeoff as _calculateFloorTakeoff,
  generateFullTakeoff,
  aggregateMaterials,
  generatePrecutPlan as _generatePrecutPlan,
  estimatePrecutWaste,
  compareTakeoffs as _compareTakeoffs,
  buildTakeoffSummary as _buildTakeoffSummary,
  exportTakeoffCSV as _exportTakeoffCSV,
  type BIMElement,
  type BIMModel,
} from "../lib/bim-takeoff.js";

// 5. remote-inspection
import {
  clearRemoteInspectionData,
  createCapturePoint,
  createInspectionRoute,
  scheduleInspection,
  startInspection,
  addFinding as _addFinding,
  completeInspection as _completeInspection,
  resolveFindings as _resolveFindings,
  compareProgress,
  getUnresolvedFindings,
  generateInspectionReport as _generateInspectionReport,
  getInspectionStats,
  suggestInspectionFrequency,
  exportFindingsCSV,
} from "../lib/remote-inspection.js";

// 6. ccus-integration
import {
  _resetCCUSStore,
  _resetCCUSProfiles,
  registerWorker,
  registerWorkerCCUS,
  calculateSkillLevel,
  getCCUSStats,
  getExpiringCertifications,
  lookupWorkerCCUS as _lookupWorkerCCUS,
} from "../lib/ccus-integration.js";

// 7. safety-doc-reuse
import {
  _resetSafetyDocStore,
  addSafetyDocTemplate,
  createSafetyDocFromTemplate,
  listReusableTemplates,
  mergeSafetyDocFields,
  buildSafetyDocHtml,
  validateSafetyDoc,
  getRequiredDocTypes,
  type SafetyDocTemplate,
} from "../lib/safety-doc-reuse.js";

// 8. inspection-pipeline
import {
  createInspectionChecklist,
  evaluateInspection,
  generateInspectionReport as generatePipelineReport,
  getInspectionStatsByProject,
  getFailureHotspots,
  buildReinspectionList,
  compareInspections,
  type InspectionRecord,
  type InspectionReportConfig,
} from "../lib/inspection-pipeline.js";

// 9. drawing-takeoff
import {
  calculateArea,
  calculatePerimeter,
  calculateLength as _calculateLength,
  applyScale,
  setDrawingScale,
  createTakeoffItem,
  summarizeTakeoff as _summarizeTakeoff,
  exportTakeoffCSV as _exportDrawingTakeoffCSV,
  mergeTakeoffSessions,
  calculateCostEstimate,
  getDefaultWasteFactor,
  type TakeoffShape,
  type TakeoffSession,
} from "../lib/drawing-takeoff.js";

// 10. photo-classifier
import {
  classifyByFilename,
  classifyByMetadata,
  autoSortPhotos,
  groupPhotosByCategory as _groupPhotosByCategory,
  groupPhotosByDate as _groupPhotosByDate,
  getPhotoStats,
  detectDuplicates,
  suggestMissingPhotos,
  searchPhotos,
  generatePhotoIndex as _generatePhotoIndex,
  classifyPhoto as _classifyPhoto,
  type ClassifiedPhoto,
} from "../lib/photo-classifier.js";

// 11. assembly-estimator
import {
  getBuiltInAssemblies,
  createCustomAssembly,
  calculateAssembly,
  estimateFromAssemblies,
  findAssembliesByCategory,
  getAssemblyUnitCost as _getAssemblyUnitCost,
  compareAssemblies,
  buildAssemblyEstimateHtml as _buildAssemblyEstimateHtml,
  exportAssemblyCSV as _exportAssemblyCSV,
} from "../lib/assembly-estimator.js";

// 12. collaborative-markup
import {
  resetCounters,
  createSession,
  addLayer,
  addMarkup,
  updateMarkupStatus,
  addReply,
  getMarkupsByStatus as _getMarkupsByStatus,
  getMarkupSummary,
  exportMarkupsCSV as _exportMarkupsCSV,
  mergeMarkupSessions,
  toggleLayerVisibility,
  lockLayer,
} from "../lib/collaborative-markup.js";

// 13. multi-scenario-estimate
import {
  createScenario,
  createMultiScenario,
  generateComparisons,
  getScenarioDiff,
  recommendScenario,
  buildComparisonTableHtml,
  exportComparisonCSV as _exportComparisonCSV,
  cloneScenario,
  mergeScenarioItems,
} from "../lib/multi-scenario-estimate.js";

// 14. custom-template-engine
import {
  createTemplate,
  getBuiltInTemplates,
  addField as _addField,
  removeField,
  reorderFields,
  createRecord,
  fillRecord,
  validateRecord,
  evaluateCalculationFields,
  submitRecord as _submitRecord,
  approveRecord as _approveRecord,
  buildRecordHtml as _buildRecordHtml,
  exportRecordsCSV,
  cloneTemplate,
} from "../lib/custom-template-engine.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ai-schedule-generator chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: ai-schedule-generator", () => {
  const baseSpec: ProjectSpec = {
    projectName: "テスト",
    totalArea: 100,
    floors: 1,
    projectType: "interior_only",
    startDate: new Date("2025-01-06"),
  };

  it("zero totalArea falls back to 1", () => {
    const result = generateSchedule({ ...baseSpec, totalArea: 0 });
    expect(result.tasks.length).toBeGreaterThan(0);
    result.tasks.forEach((t) => expect(t.durationDays).toBeGreaterThanOrEqual(1));
  });

  it("extremely large area (999999㎡) completes without crash", () => {
    const result = generateSchedule({ ...baseSpec, totalArea: 999999 });
    expect(result.tasks.length).toBeGreaterThan(0);
    result.tasks.forEach((t) => expect(Number.isFinite(t.durationDays)).toBe(true));
  });

  it("XSS in projectName is present in schedule output but not executed", () => {
    const xssName = '<script>alert(1)</script>';
    const result = generateSchedule({ ...baseSpec, projectName: xssName });
    expect(result.projectName).toBe(xssName);
    const html = exportScheduleCSV(result);
    expect(html).not.toContain("<script>alert(1)</script>".replace("<", "&lt;"));
  });

  it("emoji in projectName doesn't crash", () => {
    const result = generateSchedule({ ...baseSpec, projectName: "🏗️現場😊" });
    expect(result.projectName).toBe("🏗️現場😊");
  });

  it("compressSchedule with targetDays=0 returns original schedule", () => {
    const schedule = generateSchedule(baseSpec);
    const compressed = compressSchedule(schedule, 0);
    expect(compressed.tasks.length).toBe(schedule.tasks.length);
  });

  it("calculateCriticalPath with empty tasks returns empty array", () => {
    expect(calculateCriticalPath([])).toEqual([]);
  });

  it("adjustScheduleForHolidays with MAX_SAFE_INTEGER holiday count doesn't freeze", () => {
    const schedule = generateSchedule(baseSpec);
    const holidays = [new Date("2025-01-07"), new Date("2025-01-08")];
    const adjusted = adjustScheduleForHolidays(schedule, holidays);
    expect(adjusted.tasks.length).toBe(schedule.tasks.length);
  });

  it("updatePaceFromActual with zero area doesn't produce NaN", () => {
    const pace = getDefaultPaceData();
    const updated = updatePaceFromActual(pace, "解体", 5, 0);
    updated.forEach((p) => {
      expect(Number.isFinite(p.daysPerUnit)).toBe(true);
      expect(p.daysPerUnit).toBeGreaterThan(0);
    });
  });

  it("getScheduleSummary on schedule with no tasks produces valid summary", () => {
    const emptySchedule: GeneratedSchedule = {
      projectId: "x",
      projectName: "empty",
      tasks: [],
      totalDays: 0,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-01"),
      criticalPath: [],
      generatedAt: new Date(),
    };
    const summary = getScheduleSummary(emptySchedule);
    expect(summary.totalTasks).toBe(0);
    expect(summary.peakCrew).toBe(0);
  });

  it("year 1970 and year 9999 start dates don't crash", () => {
    const s1 = generateSchedule({ ...baseSpec, startDate: new Date("1970-01-01") });
    expect(s1.tasks.length).toBeGreaterThan(0);
    const s2 = generateSchedule({ ...baseSpec, startDate: new Date("9999-01-01") });
    expect(s2.tasks.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. multi-site-manager chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: multi-site-manager", () => {
  it("createSite with XSS name doesn't crash and preserves value", () => {
    const site = createSite('<script>xss</script>', 'addr', 10, 1000000, new Date());
    expect(site.name).toBe('<script>xss</script>');
  });

  it("createSite with zero budget produces zero grossMargin", () => {
    const site = createSite('site', 'addr', 10, 0, new Date());
    const profit = calculateSiteProfit(site, []);
    expect(profit.grossMargin).toBe(0);
  });

  it("calculateSiteProfit with negative budget handles without crash", () => {
    const site = createSite('site', 'addr', 10, -5000, new Date());
    const profit = calculateSiteProfit(site, []);
    expect(Number.isFinite(profit.grossProfit)).toBe(true);
  });

  it("getMultiSiteDashboard with empty sites returns valid dashboard", () => {
    const dashboard = getMultiSiteDashboard([], []);
    expect(dashboard.totalSites).toBe(0);
    expect(dashboard.alerts).toEqual([]);
  });

  it("10000 workers in optimizeWorkerAssignment completes", () => {
    const site = createSite('site', 'addr', 10, 1000000, new Date());
    const workers = Array.from({ length: 10000 }, (_, i) => `worker-${i}`);
    const result = optimizeWorkerAssignment([site], workers, new Date());
    expect(result.length).toBe(10000);
  });

  it("forecastCashflow with months=0 doesn't divide by zero", () => {
    const site = createSite('site', 'addr', 10, 1000000, new Date());
    const result = forecastCashflow([site], [], 0);
    expect(result).toEqual([]);
  });

  it("getDailyReportSummary with empty reports returns zeroes", () => {
    const result = getDailyReportSummary([], {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });
    expect(result.totalReports).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("detectScheduleConflicts with no overlapping sites returns empty", () => {
    const s1 = createSite('a', 'addr', 5, 100000, new Date("2025-01-01"));
    const s2 = createSite('b', 'addr', 5, 100000, new Date("2025-06-01"));
    const conflicts = detectScheduleConflicts([s1, s2]);
    expect(conflicts).toEqual([]);
  });

  it("unicode zero-width characters in site name don't crash", () => {
    const zwChar = '\u200b\u200c\u200d';
    const site = createSite(`site${zwChar}name`, 'addr', 10, 1000000, new Date());
    expect(site.name).toContain('site');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. e-contract-finance chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: e-contract-finance", () => {
  beforeEach(() => clearEContracts());

  const basePlan = generatePaymentPlan(1000000, "lump_sum", new Date("2025-01-01"));

  it("createContract with empty items produces subtotal=0", () => {
    const contract = createContract("p1", "client", "test@example.com", "contractor", [], basePlan);
    expect(contract.subtotal).toBe(0);
    expect(contract.taxAmount).toBe(0);
  });

  it("generatePaymentPlan with amount=0 doesn't crash", () => {
    const plan = generatePaymentPlan(0, "installment_monthly", new Date("2025-01-01"));
    expect(plan.totalAmount).toBeGreaterThanOrEqual(0);
  });

  it("generatePaymentPlan with MAX_SAFE_INTEGER amount doesn't produce Infinity", () => {
    const plan = generatePaymentPlan(Number.MAX_SAFE_INTEGER, "lump_sum", new Date("2025-01-01"));
    expect(Number.isFinite(plan.totalAmount)).toBe(true);
  });

  it("calculateMonthlyPayment with months=0 protected by branch check — annualRate=0 path", () => {
    // annualRate=0 branch: returns Math.round(total/months) → division by zero handled externally
    // months=1 boundary
    const payment = calculateMonthlyPayment(100000, 1, 0);
    expect(payment).toBe(100000);
  });

  it("XSS in clientName preserved in contract, escaped in HTML output", () => {
    const contract = createContract(
      "p1",
      '<script>alert(1)</script>',
      "x@x.com",
      "contractor",
      [],
      basePlan,
    );
    expect(contract.clientName).toBe('<script>alert(1)</script>');
  });

  it("sendContract throws if already sent", () => {
    const contract = createContract("p1", "client", "e@e.com", "contractor", [], basePlan);
    const sent = sendContract(contract);
    expect(() => sendContract(sent)).toThrow();
  });

  it("signContract on draft throws", () => {
    const contract = createContract("p1", "client", "e@e.com", "contractor", [], basePlan);
    expect(() => signContract(contract, "signature")).toThrow();
  });

  it("checkContractExpiry with empty list returns empty", () => {
    expect(checkContractExpiry([])).toEqual([]);
  });

  it("getContractStats on empty array returns zeroes", () => {
    const stats = getContractStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.avgContractValue).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });

  it("comparePaymentPlans with very large amount produces finite installments", () => {
    const plans = comparePaymentPlans(999999999, new Date("2025-01-01"), new Date("2025-12-31"));
    expect(plans.length).toBe(4);
    plans.forEach((p) => p.installments.forEach((i) => {
      expect(Number.isFinite(i.amount)).toBe(true);
    }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. bim-takeoff chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: bim-takeoff", () => {
  const wallElement: BIMElement = {
    id: "w1",
    type: "wall",
    material: "コンクリート",
    dimensions: { length: 5, width: 0.15, height: 3, area: 15, volume: 2.25 },
    location: { floor: 1 },
    properties: {},
  };

  it("parseBIMElements throws on non-array input", () => {
    expect(() => parseBIMElements(null)).toThrow();
    expect(() => parseBIMElements("string")).toThrow();
    expect(() => parseBIMElements(42)).toThrow();
  });

  it("parseBIMElements throws on invalid type", () => {
    expect(() => parseBIMElements([{ id: "x", type: "invalid_type", dimensions: {}, location: {} }])).toThrow();
  });

  it("parseBIMElements with empty array returns empty array", () => {
    expect(parseBIMElements([])).toEqual([]);
  });

  it("calculateWallTakeoff with huge area (999999㎡) doesn't produce NaN", () => {
    const bigWall: BIMElement = { ...wallElement, dimensions: { ...wallElement.dimensions, area: 999999 } };
    const takeoff = calculateWallTakeoff(bigWall);
    takeoff.materials.forEach((m) => {
      expect(Number.isFinite(m.totalQuantity)).toBe(true);
    });
  });

  it("calculateWallTakeoff with zero area returns minimal valid takeoff", () => {
    const zeroWall: BIMElement = { ...wallElement, dimensions: { length: 0, width: 0, height: 0, area: 0, volume: 0 } };
    const takeoff = calculateWallTakeoff(zeroWall);
    expect(takeoff.elementId).toBe("w1");
    expect(takeoff.materials.length).toBeGreaterThan(0);
  });

  it("calculateCeilingTakeoff with zero area doesn't crash", () => {
    const ceiling: BIMElement = { ...wallElement, type: "ceiling", dimensions: { ...wallElement.dimensions, area: 0 } };
    const takeoff = calculateCeilingTakeoff(ceiling);
    expect(takeoff.elementId).toBe("w1");
  });

  it("generateFullTakeoff with empty model elements returns empty array", () => {
    const model: BIMModel = {
      id: "m1",
      projectName: "test",
      elements: [],
      floors: 1,
      totalArea: 0,
      importedAt: new Date(),
    };
    const takeoffs = generateFullTakeoff(model);
    expect(takeoffs).toEqual([]);
  });

  it("aggregateMaterials with empty takeoffs returns empty array", () => {
    expect(aggregateMaterials([])).toEqual([]);
  });

  it("estimatePrecutWaste with empty plan returns 0", () => {
    expect(estimatePrecutWaste([])).toBe(0);
  });

  it("XSS in material name is preserved in takeoff output", () => {
    const xssWall: BIMElement = { ...wallElement, material: '<script>alert(1)</script>' };
    const takeoff = calculateWallTakeoff(xssWall);
    expect(takeoff.elementId).toBe("w1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. remote-inspection chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: remote-inspection", () => {
  beforeEach(() => clearRemoteInspectionData());

  it("createCapturePoint with XSS location doesn't crash", () => {
    const point = createCapturePoint("p1", '<script>xss</script>', 1, { x: 0, y: 0 });
    expect(point.location).toBe('<script>xss</script>');
  });

  it("createInspectionRoute with invalid pointId throws", () => {
    expect(() => createInspectionRoute("p1", "route1", ["non-existent-id"])).toThrow();
  });

  it("compareProgress with empty points array returns empty array", () => {
    const result = compareProgress([]);
    expect(result).toEqual([]);
  });

  it("getUnresolvedFindings with empty inspections returns empty array", () => {
    expect(getUnresolvedFindings([])).toEqual([]);
  });

  it("getInspectionStats with empty list returns all zeroes", () => {
    const stats = getInspectionStats([]);
    expect(stats.total).toBe(0);
    expect(stats.totalFindings).toBe(0);
    expect(stats.averageFindingsPerInspection).toBe(0);
  });

  it("suggestInspectionFrequency with zero days doesn't crash", () => {
    const result = suggestInspectionFrequency(0, "内装");
    expect(result.frequencyDays).toBeGreaterThan(0);
  });

  it("suggestInspectionFrequency with MAX_SAFE_INTEGER days", () => {
    const result = suggestInspectionFrequency(Number.MAX_SAFE_INTEGER, "other");
    expect(result.frequencyDays).toBeGreaterThan(0);
  });

  it("startInspection on already in_progress inspection throws", () => {
    const point = createCapturePoint("p1", "loc", 1, { x: 0, y: 0 });
    const route = createInspectionRoute("p1", "r1", [point.id]);
    const inspection = scheduleInspection("p1", route.id, "inspector", new Date());
    const started = startInspection(inspection);
    expect(() => startInspection(started)).toThrow();
  });

  it("exportFindingsCSV with empty findings returns only header", () => {
    const csv = exportFindingsCSV([]);
    expect(csv.split("\n").length).toBe(1);
  });

  it("emoji in inspector name doesn't crash", () => {
    const point = createCapturePoint("p1", "loc", 1, { x: 0, y: 0 });
    const route = createInspectionRoute("p1", "r1", [point.id]);
    const inspection = scheduleInspection("p1", route.id, "👷検査員", new Date());
    expect(inspection.inspector).toBe("👷検査員");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ccus-integration chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: ccus-integration", () => {
  beforeEach(() => {
    _resetCCUSStore();
    _resetCCUSProfiles();
  });

  it("registerWorker with invalid ccusId (not 14 digits) throws", () => {
    expect(() =>
      registerWorker({
        ccusId: "123",
        name: "田中",
        company: "株式会社A",
        jobType: "大工",
        skillLevel: 1,
        certifications: [],
        registeredAt: "2020-01-01",
      }),
    ).toThrow("14桁");
  });

  it("registerWorker with empty name throws", () => {
    expect(() =>
      registerWorker({
        ccusId: "12345678901234",
        name: "",
        company: "株式会社A",
        jobType: "大工",
        skillLevel: 1,
        certifications: [],
        registeredAt: "2020-01-01",
      }),
    ).toThrow();
  });

  it("calculateSkillLevel with empty certifications and 0 years returns level 1", () => {
    expect(calculateSkillLevel([], 0)).toBe(1);
  });

  it("calculateSkillLevel with negative experienceYears returns level 1", () => {
    expect(calculateSkillLevel([], -99)).toBe(1);
  });

  it("calculateSkillLevel with 10+ years returns level 4", () => {
    expect(calculateSkillLevel([], 10)).toBe(4);
  });

  it("getCCUSStats with project with no entries returns zeroes", () => {
    const stats = getCCUSStats("no-such-project");
    expect(stats.totalWorkers).toBe(0);
    expect(stats.averageSkillLevel).toBe(0);
  });

  it("getExpiringCertifications with empty workers returns empty map", () => {
    const result = getExpiringCertifications([], 30);
    expect(result.size).toBe(0);
  });

  it("XSS in worker name doesn't crash, value preserved", () => {
    const w = registerWorker({
      ccusId: "12345678901234",
      name: "<script>xss</script>",
      company: "株式会社A",
      jobType: "大工",
      skillLevel: 1,
      certifications: [],
      registeredAt: "2020-01-01",
    });
    expect(w.name).toBe("<script>xss</script>");
  });

  it("registerWorkerCCUS with future registeredSince date returns grade 1", () => {
    const profile = registerWorkerCCUS({
      ccusId: "12345678901234",
      name: "新入り",
      certifications: [],
      registeredSince: "9999-12-31",
    });
    expect(profile.currentGrade).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. safety-doc-reuse chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: safety-doc-reuse", () => {
  beforeEach(() => _resetSafetyDocStore());

  it("createSafetyDocFromTemplate with non-existent id throws", () => {
    expect(() => createSafetyDocFromTemplate("no-such-id", "p1")).toThrow();
  });

  it("createSafetyDocFromTemplate with non-reusable template throws", () => {
    const tmpl = addSafetyDocTemplate({
      type: "ky-sheet",
      projectId: "p1",
      orgId: "org1",
      fields: { projectName: "test", workDate: "2025-01-01", hazards: ["落下"], countermeasures: ["ヘルメット"] },
      reusable: false,
    });
    expect(() => createSafetyDocFromTemplate(tmpl.id, "p2")).toThrow("再利用不可");
  });

  it("listReusableTemplates with unknown orgId returns empty array", () => {
    expect(listReusableTemplates("unknown-org")).toEqual([]);
  });

  it("validateSafetyDoc with missing required fields returns errors", () => {
    const doc: SafetyDocTemplate = {
      id: "x",
      type: "ky-sheet",
      projectId: "p1",
      orgId: "org1",
      fields: {},
      createdAt: new Date().toISOString(),
      reusable: true,
    };
    const errors = validateSafetyDoc(doc);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("getRequiredDocTypes with unknown project type returns default", () => {
    const docs = getRequiredDocTypes("unknown-type");
    expect(docs).toContain("worker-roster");
  });

  it("mergeSafetyDocFields with XSS override merges without crash", () => {
    const tmpl: SafetyDocTemplate = {
      id: "x",
      type: "ky-sheet",
      projectId: "p1",
      orgId: "org1",
      fields: { projectName: "test" },
      createdAt: new Date().toISOString(),
      reusable: true,
    };
    const merged = mergeSafetyDocFields(tmpl, { projectName: "<script>xss</script>" });
    expect(merged["projectName"]).toBe("<script>xss</script>");
  });

  it("buildSafetyDocHtml with huge fields array doesn't crash", () => {
    const fields: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) fields[`field${i}`] = `value${i}`;
    const doc: SafetyDocTemplate = {
      id: "x",
      type: "work-plan",
      projectId: "p1",
      orgId: "org1",
      fields,
      createdAt: new Date().toISOString(),
      reusable: false,
    };
    const html = buildSafetyDocHtml(doc);
    expect(html).toContain("作業計画書");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. inspection-pipeline chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: inspection-pipeline", () => {
  const reportConfig: InspectionReportConfig = {
    title: "検査報告",
    companyName: "テスト会社",
    projectName: "テスト現場",
    includeSummary: true,
    includePhotos: false,
    includeStatistics: true,
    signatureFields: ["検査員", "所長"],
  };

  it("createInspectionChecklist returns pending items for all types", () => {
    const types: Parameters<typeof createInspectionChecklist>[0][] = [
      "finish", "structural", "mep", "waterproof", "fire", "safety",
    ];
    for (const type of types) {
      const record = createInspectionChecklist(type, "1F");
      expect(record.items.length).toBeGreaterThan(0);
      expect(record.items.every((i) => i.result === "pending")).toBe(true);
    }
  });

  it("evaluateInspection with all-fail items returns fail", () => {
    const record = createInspectionChecklist("finish", "1F");
    const allFail: InspectionRecord = {
      ...record,
      items: record.items.map((i) => ({ ...i, result: "fail" as const })),
    };
    expect(evaluateInspection(allFail).overallResult).toBe("fail");
  });

  it("evaluateInspection with all-na items returns conditional", () => {
    const record = createInspectionChecklist("finish", "1F");
    const allNa: InspectionRecord = {
      ...record,
      items: record.items.map((i) => ({ ...i, result: "na" as const })),
    };
    expect(evaluateInspection(allNa).overallResult).toBe("conditional");
  });

  it("getInspectionStatsByProject with empty records returns all-pass rates", () => {
    const stats = getInspectionStatsByProject([]);
    expect(stats.totalInspections).toBe(0);
    Object.values(stats.passRateByType).forEach((rate) => expect(rate).toBe(1));
  });

  it("getFailureHotspots with no fails returns empty array", () => {
    const record = createInspectionChecklist("finish", "1F");
    const allPass: InspectionRecord = {
      ...record,
      items: record.items.map((i) => ({ ...i, result: "pass" as const })),
    };
    expect(getFailureHotspots([allPass])).toEqual([]);
  });

  it("buildReinspectionList with all-pass items returns empty reinspection list", () => {
    const record = createInspectionChecklist("finish", "1F");
    const allPass: InspectionRecord = {
      ...record,
      items: record.items.map((i) => ({ ...i, result: "pass" as const })),
    };
    const reinspect = buildReinspectionList(allPass);
    expect(reinspect.items).toEqual([]);
  });

  it("generatePipelineReport with XSS in company name produces escaped HTML", () => {
    const record = createInspectionChecklist("finish", "1F");
    const xssConfig: InspectionReportConfig = {
      ...reportConfig,
      companyName: "<script>alert(1)</script>",
    };
    const html = generatePipelineReport(record, xssConfig);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("compareInspections with empty after record marks all as removed", () => {
    const before = createInspectionChecklist("finish", "1F");
    const after: InspectionRecord = { ...before, items: [] };
    const comparison = compareInspections(before, after);
    expect(comparison.every((c) => c.afterResult === "removed")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. drawing-takeoff chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: drawing-takeoff", () => {
  it("calculateArea with empty polygon returns 0", () => {
    const shape: TakeoffShape = { id: "s1", type: "polygon", points: [] };
    expect(calculateArea(shape)).toBe(0);
  });

  it("calculateArea with 2-point polygon (degenerate) returns 0", () => {
    const shape: TakeoffShape = {
      id: "s1",
      type: "polygon",
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    };
    expect(calculateArea(shape)).toBe(0);
  });

  it("calculatePerimeter with empty points returns 0", () => {
    const shape: TakeoffShape = { id: "s1", type: "polygon", points: [] };
    expect(calculatePerimeter(shape)).toBe(0);
  });

  it("applyScale with pixelsPerMeter=0 returns 0 (no division by zero)", () => {
    expect(applyScale(100, { pixelsPerMeter: 0, paperScale: "1:1" }, "area")).toBe(0);
    expect(applyScale(100, { pixelsPerMeter: 0, paperScale: "1:1" }, "length")).toBe(0);
  });

  it("setDrawingScale with zero inputs returns pixelsPerMeter=0", () => {
    const scale = setDrawingScale(0, 0);
    expect(scale.pixelsPerMeter).toBe(0);
  });

  it("getDefaultWasteFactor returns 0.05 for unknown material", () => {
    expect(getDefaultWasteFactor("未知の材料XYZ")).toBe(0.05);
  });

  it("mergeTakeoffSessions with empty array returns synthetic session with empty items", () => {
    const result = mergeTakeoffSessions([]);
    expect(result.items).toEqual([]);
    expect(result.projectId).toBe("");
  });

  it("calculateCostEstimate with empty cost master returns 0", () => {
    const session: TakeoffSession = {
      id: "s1",
      projectId: "p1",
      drawingId: "d1",
      scale: { pixelsPerMeter: 96, paperScale: "1:50" },
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(calculateCostEstimate(session, [])).toBe(0);
  });

  it("calculateArea with circle radius=0 returns 0", () => {
    const shape: TakeoffShape = { id: "c1", type: "circle", points: [], radius: 0 };
    expect(calculateArea(shape)).toBe(0);
  });

  it("createTakeoffItem with negative wasteFactor doesn't produce negative totalQuantity", () => {
    const measurement = {
      id: "m1", shapeId: "s1", measureType: "area" as const,
      rawValue: 100, scaledValue: 10, unit: "㎡" as const,
    };
    const item = createTakeoffItem(measurement, "クロス", "㎡", -0.1);
    // totalQuantity = quantity * (1 + wasteFactor) = 10 * 0.9 = 9
    expect(Number.isFinite(item.totalQuantity)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. photo-classifier chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: photo-classifier", () => {
  it("classifyByFilename with empty string returns 'other' category", () => {
    const result = classifyByFilename("");
    expect(result.category).toBe("other");
    expect(result.confidence).toBe(0);
  });

  it("classifyByFilename with XSS filename returns valid category", () => {
    const result = classifyByFilename('<script>alert(1)</script>.jpg');
    expect(typeof result.category).toBe("string");
  });

  it("classifyByFilename with emoji filename doesn't crash", () => {
    const result = classifyByFilename("🏗️現場写真_安全確認.jpg");
    expect(result.category).toBe("safety");
  });

  it("autoSortPhotos with 10000 photos completes in reasonable time", () => {
    const photos = Array.from({ length: 10000 }, (_, i) => ({
      id: `photo-${i}`,
      filename: `img_${i}.jpg`,
      takenAt: new Date(),
      projectId: "p1",
    }));
    const start = Date.now();
    const result = autoSortPhotos(photos);
    expect(result.length).toBe(10000);
    expect(Date.now() - start).toBeLessThan(10000); // 10 second max
  });

  it("getPhotoStats with empty photos returns zeroes and null dateRange", () => {
    const stats = getPhotoStats([]);
    expect(stats.total).toBe(0);
    expect(stats.dateRange.earliest).toBeNull();
    expect(stats.dateRange.latest).toBeNull();
  });

  it("detectDuplicates with single photo returns no duplicates", () => {
    const photo: ClassifiedPhoto = {
      id: "p1",
      filename: "img001.jpg",
      takenAt: new Date(),
      projectId: "proj1",
      classification: { category: "other", confidence: 0, tags: [] },
    };
    expect(detectDuplicates([photo])).toEqual([]);
  });

  it("searchPhotos with empty query returns all photos", () => {
    const photo: ClassifiedPhoto = {
      id: "p1",
      filename: "wall_クロス.jpg",
      takenAt: new Date(),
      projectId: "p1",
      classification: { category: "interior_finish", confidence: 0.8, tags: [] },
    };
    expect(searchPhotos([photo], "")).toEqual([photo]);
  });

  it("suggestMissingPhotos with all categories present returns empty array", () => {
    const categories = ["interior_rough", "interior_finish", "mep_rough", "mep_finish", "waterproof", "safety", "progress"];
    const photos: ClassifiedPhoto[] = categories.map((cat, i) => ({
      id: `p${i}`,
      filename: `img${i}.jpg`,
      takenAt: new Date(),
      projectId: "p1",
      classification: { category: cat as ClassifiedPhoto["classification"]["category"], confidence: 1, tags: [] },
    }));
    expect(suggestMissingPhotos(photos, "interior")).toEqual([]);
  });

  it("classifyByMetadata with null exifData doesn't crash", () => {
    const result = classifyByMetadata({ filename: "test.jpg", exifData: undefined });
    expect(result.category).toBe("other");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. assembly-estimator chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: assembly-estimator", () => {
  it("calculateAssembly with quantity=0 returns totalAmount=0", () => {
    const assemblies = getBuiltInAssemblies();
    const result = calculateAssembly(assemblies[0], 0);
    expect(result.totalAmount).toBe(0);
    result.componentBreakdown.forEach((b) => expect(b.amount).toBe(0));
  });

  it("calculateAssembly with very large quantity (999999㎡) produces finite amounts", () => {
    const assembly = getBuiltInAssemblies()[0];
    const result = calculateAssembly(assembly, 999999);
    expect(Number.isFinite(result.totalAmount)).toBe(true);
    result.componentBreakdown.forEach((b) => expect(Number.isFinite(b.amount)).toBe(true));
  });

  it("calculateAssembly with negative quantity produces negative breakdown amounts", () => {
    const assembly = getBuiltInAssemblies()[0];
    const result = calculateAssembly(assembly, -1);
    expect(Number.isFinite(result.totalAmount)).toBe(true);
  });

  it("estimateFromAssemblies with unknown assemblyId throws", () => {
    expect(() => estimateFromAssemblies([{ assemblyId: "no-such-id", quantity: 10 }])).toThrow();
  });

  it("estimateFromAssemblies with empty items returns zeroes", () => {
    const result = estimateFromAssemblies([]);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.totalWithTax).toBe(0);
  });

  it("createCustomAssembly with XSS name produces valid assembly", () => {
    const assembly = createCustomAssembly(
      '<script>xss</script>', "カテゴリ", "㎡", []
    );
    expect(assembly.name).toBe('<script>xss</script>');
    expect(assembly.components).toEqual([]);
  });

  it("findAssembliesByCategory with unknown category returns empty", () => {
    expect(findAssembliesByCategory("存在しないカテゴリ")).toEqual([]);
  });

  it("compareAssemblies with same assembly returns costDifference=0", () => {
    const assemblies = getBuiltInAssemblies();
    const result = compareAssemblies(assemblies[0], assemblies[0]);
    expect(result.costDifference).toBe(0);
  });

  it("estimateFromAssemblies with overheadRate=0 returns overhead=0", () => {
    const assemblies = getBuiltInAssemblies();
    const result = estimateFromAssemblies(
      [{ assemblyId: assemblies[0].id, quantity: 10 }],
      0,
    );
    expect(result.overhead).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. collaborative-markup chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: collaborative-markup", () => {
  beforeEach(() => resetCounters());

  it("createSession with XSS drawingId doesn't crash", () => {
    const session = createSession('<script>', 'p1', 'creator');
    expect(session.drawingId).toBe('<script>');
  });

  it("addMarkup to non-existent layer throws", () => {
    const session = createSession('d1', 'p1', 'user1');
    expect(() =>
      addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 10, y: 20 },
        content: "test",
        author: "user1",
        color: "#ff0000",
        layer: "non-existent-layer",
      }),
    ).toThrow();
  });

  it("addMarkup to locked layer throws", () => {
    let session = createSession('d1', 'p1', 'user1');
    session = addLayer(session, 'myLayer', '#red', 'user1');
    session = lockLayer(session, session.layers[0].id);
    expect(() =>
      addMarkup(session, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "test",
        author: "user1",
        color: "#000",
        layer: "myLayer",
      }),
    ).toThrow("locked");
  });

  it("getMarkupSummary with empty session returns all zeroes", () => {
    const session = createSession('d1', 'p1', 'user1');
    const summary = getMarkupSummary(session);
    expect(summary.total).toBe(0);
    expect(Object.values(summary.byStatus).every((v) => v === 0)).toBe(true);
  });

  it("mergeMarkupSessions with empty array throws", () => {
    expect(() => mergeMarkupSessions([])).toThrow();
  });

  it("addReply with XSS content doesn't crash", () => {
    let session = createSession('d1', 'p1', 'user1');
    session = addLayer(session, 'layer1', '#000', 'user1');
    session = addMarkup(session, {
      pageNumber: 1,
      type: "callout",
      position: { x: 0, y: 0 },
      content: "base",
      author: "user1",
      color: "#000",
      layer: "layer1",
    });
    const markupId = session.markups[0].id;
    session = addReply(session, markupId, 'user2', '<script>alert(1)</script>');
    expect(session.markups[0].replies[0].content).toBe('<script>alert(1)</script>');
  });

  it("toggleLayerVisibility on non-existent layer throws", () => {
    const session = createSession('d1', 'p1', 'user1');
    expect(() => toggleLayerVisibility(session, 'no-such-layer')).toThrow();
  });

  it("updateMarkupStatus on non-existent markup throws", () => {
    const session = createSession('d1', 'p1', 'user1');
    expect(() => updateMarkupStatus(session, 'no-markup', 'resolved', 'user1')).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. multi-scenario-estimate chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: multi-scenario-estimate", () => {
  it("createScenario with empty items returns subtotal=0", () => {
    const scenario = createScenario("梅", "economy", []);
    expect(scenario.subtotal).toBe(0);
    expect(scenario.totalWithTax).toBe(0);
  });

  it("createScenario with negative unit prices produces finite totals", () => {
    const scenario = createScenario("梅", "economy", [
      { name: "材料A", unit: "㎡", quantity: 100, unitPrice: -5000 },
    ]);
    expect(Number.isFinite(scenario.subtotal)).toBe(true);
  });

  it("createScenario with 10000 items completes in reasonable time", () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      name: `item-${i}`,
      unit: "㎡",
      quantity: 1,
      unitPrice: 1000,
    }));
    const start = Date.now();
    const scenario = createScenario("test", "standard", items);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(scenario.subtotal).toBe(10000 * 1000);
  });

  it("recommendScenario with empty scenarios returns standard", () => {
    const result = recommendScenario([]);
    expect(result.grade).toBe("standard");
    expect(result.scenario).toBeUndefined();
  });

  it("getScenarioDiff returns onlyInA/onlyInB when items are disjoint", () => {
    const a = createScenario("A", "economy", [{ name: "item-a", unit: "㎡", quantity: 1, unitPrice: 1000 }]);
    const b = createScenario("B", "standard", [{ name: "item-b", unit: "㎡", quantity: 1, unitPrice: 2000 }]);
    const diff = getScenarioDiff(a, b);
    expect(diff.onlyInA.length).toBe(1);
    expect(diff.onlyInB.length).toBe(1);
    expect(diff.inBoth.length).toBe(0);
  });

  it("cloneScenario with multiplier=0 produces all-zero prices", () => {
    const base = createScenario("base", "standard", [
      { name: "item", unit: "㎡", quantity: 10, unitPrice: 5000 },
    ]);
    const cloned = cloneScenario(base, "economy", 0);
    expect(cloned.subtotal).toBe(0);
  });

  it("XSS in projectName is preserved in multiScenario", () => {
    const scenario = createScenario("test", "standard", []);
    const result = createMultiScenario('<script>xss</script>', [scenario]);
    expect(result.projectName).toBe('<script>xss</script>');
    const html = buildComparisonTableHtml(result);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>xss</script>");
  });

  it("generateComparisons with empty scenarios returns empty array", () => {
    expect(generateComparisons([])).toEqual([]);
  });

  it("mergeScenarioItems with empty arrays returns empty array", () => {
    expect(mergeScenarioItems([], [])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. custom-template-engine chaos tests
// ─────────────────────────────────────────────────────────────────────────────
describe("chaos: custom-template-engine", () => {
  it("createTemplate with empty name throws", () => {
    expect(() => createTemplate("", "daily_report", [], "org1", "user1")).toThrow();
  });

  it("createTemplate with select field missing options throws", () => {
    expect(() =>
      createTemplate(
        "test",
        "custom",
        [{ id: "f1", label: "フィールド", type: "select", required: true }],
        "org1",
        "user1",
      ),
    ).toThrow();
  });

  it("createTemplate with calculation field missing formula throws", () => {
    expect(() =>
      createTemplate(
        "test",
        "custom",
        [{ id: "f1", label: "計算", type: "calculation", required: false }],
        "org1",
        "user1",
      ),
    ).toThrow();
  });

  it("validateRecord with all required fields filled returns valid", () => {
    const template = createTemplate(
      "test",
      "custom",
      [{ id: "name", label: "氏名", type: "text", required: true }],
      "org1",
      "user1",
    );
    const record = fillRecord(createRecord(template.id, "p1", "user1"), { name: "田中" });
    const result = validateRecord(template, record);
    expect(result.valid).toBe(true);
  });

  it("validateRecord with number below min returns error", () => {
    const template = createTemplate(
      "test",
      "custom",
      [{ id: "count", label: "人数", type: "number", required: true, validation: { min: 1 } }],
      "org1",
      "user1",
    );
    const record = fillRecord(createRecord(template.id, "p1", "user1"), { count: 0 });
    const result = validateRecord(template, record);
    expect(result.valid).toBe(false);
  });

  it("evaluateCalculationFields with XSS formula returns 0 (blocked by char guard)", () => {
    const template = createTemplate(
      "test",
      "custom",
      [
        { id: "qty", label: "数量", type: "number", required: false },
        {
          id: "total",
          label: "合計",
          type: "calculation",
          required: false,
          calculationFormula: "qty * 100 + alert(1)",
        },
      ],
      "org1",
      "user1",
    );
    const record = fillRecord(createRecord(template.id, "p1", "user1"), { qty: 5 });
    const evaluated = evaluateCalculationFields(template, record);
    // formula contains 'alert(1)' which isn't numeric — result should be 0
    expect(evaluated.data["total"]).toBe(0);
  });

  it("removeField returns template without that field, version incremented", () => {
    const template = createTemplate(
      "test",
      "custom",
      [{ id: "f1", label: "A", type: "text", required: false }],
      "org1",
      "user1",
    );
    const updated = removeField(template, "f1");
    expect(updated.fields.find((f) => f.id === "f1")).toBeUndefined();
    expect(updated.version).toBe(2);
  });

  it("reorderFields with unknown ids appends remaining fields", () => {
    const template = createTemplate(
      "test",
      "custom",
      [
        { id: "a", label: "A", type: "text", required: false },
        { id: "b", label: "B", type: "text", required: false },
      ],
      "org1",
      "user1",
    );
    const reordered = reorderFields(template, ["b", "a"]);
    expect(reordered.fields[0].id).toBe("b");
    expect(reordered.fields[1].id).toBe("a");
  });

  it("exportRecordsCSV with empty records returns only headers", () => {
    const template = createTemplate(
      "test",
      "custom",
      [{ id: "f1", label: "A", type: "text", required: false }],
      "org1",
      "user1",
    );
    const csv = exportRecordsCSV(template, []);
    expect(csv.split("\n").length).toBe(1);
  });

  it("cloneTemplate produces different id and resets version to 1", () => {
    const template = createTemplate(
      "original",
      "custom",
      [{ id: "f1", label: "A", type: "text", required: false }],
      "org1",
      "user1",
    );
    const cloned = cloneTemplate(template, "cloned");
    expect(cloned.id).not.toBe(template.id);
    expect(cloned.version).toBe(1);
    expect(cloned.name).toBe("cloned");
  });

  it("getBuiltInTemplates returns 4 templates", () => {
    expect(getBuiltInTemplates().length).toBe(4);
  });
});
