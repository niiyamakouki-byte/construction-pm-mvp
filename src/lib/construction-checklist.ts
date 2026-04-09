/**
 * Construction phase checklist module for GenbaHub.
 * Provides standard inspection items per construction phase
 * and phase completion evaluation.
 */

export const ConstructionPhase = {
  demolition: "demolition",
  foundation: "foundation",
  framing: "framing",
  roofing: "roofing",
  exterior: "exterior",
  interior: "interior",
  finishing: "finishing",
  inspection: "inspection",
} as const;

export type ConstructionPhase = (typeof ConstructionPhase)[keyof typeof ConstructionPhase];

const PHASE_LABELS: Record<ConstructionPhase, string> = {
  demolition: "解体工事",
  foundation: "基礎工事",
  framing: "躯体工事",
  roofing: "屋根工事",
  exterior: "外装工事",
  interior: "内装工事",
  finishing: "仕上げ工事",
  inspection: "完了検査",
};

export function getPhaseLabel(phase: ConstructionPhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export type ChecklistItem = {
  id: string;
  phase: ConstructionPhase;
  description: string;
  descriptionJa: string;
  required: boolean;
};

const PHASE_CHECKLISTS: Record<ConstructionPhase, Omit<ChecklistItem, "id">[]> = {
  demolition: [
    { phase: "demolition", description: "Utility disconnection confirmed", descriptionJa: "ライフライン切断確認", required: true },
    { phase: "demolition", description: "Asbestos survey completed", descriptionJa: "アスベスト調査完了", required: true },
    { phase: "demolition", description: "Demolition permit obtained", descriptionJa: "解体許可取得", required: true },
    { phase: "demolition", description: "Neighboring property protection installed", descriptionJa: "近隣養生設置", required: true },
    { phase: "demolition", description: "Waste disposal plan approved", descriptionJa: "廃棄物処理計画承認", required: true },
    { phase: "demolition", description: "Site cleared and leveled", descriptionJa: "整地完了", required: false },
  ],
  foundation: [
    { phase: "foundation", description: "Soil investigation completed", descriptionJa: "地盤調査完了", required: true },
    { phase: "foundation", description: "Excavation to design depth", descriptionJa: "設計深度まで掘削完了", required: true },
    { phase: "foundation", description: "Rebar placement inspected", descriptionJa: "配筋検査完了", required: true },
    { phase: "foundation", description: "Formwork aligned and secured", descriptionJa: "型枠設置・確認", required: true },
    { phase: "foundation", description: "Concrete pour completed", descriptionJa: "コンクリート打設完了", required: true },
    { phase: "foundation", description: "Curing period observed", descriptionJa: "養生期間確保", required: true },
    { phase: "foundation", description: "Waterproofing applied", descriptionJa: "防水処理完了", required: false },
  ],
  framing: [
    { phase: "framing", description: "Structural steel/wood delivered and inspected", descriptionJa: "構造材搬入・検査", required: true },
    { phase: "framing", description: "Column placement verified", descriptionJa: "柱建て確認", required: true },
    { phase: "framing", description: "Beam connections inspected", descriptionJa: "梁接合部検査", required: true },
    { phase: "framing", description: "Floor slab completed", descriptionJa: "床スラブ完了", required: true },
    { phase: "framing", description: "Structural inspection passed", descriptionJa: "構造検査合格", required: true },
    { phase: "framing", description: "Bracing and shear walls installed", descriptionJa: "筋交い・耐力壁設置", required: false },
  ],
  roofing: [
    { phase: "roofing", description: "Roof framing completed", descriptionJa: "屋根下地完了", required: true },
    { phase: "roofing", description: "Waterproof membrane installed", descriptionJa: "防水シート施工", required: true },
    { phase: "roofing", description: "Roofing material installed", descriptionJa: "屋根材施工完了", required: true },
    { phase: "roofing", description: "Flashing and trim completed", descriptionJa: "水切り・板金完了", required: true },
    { phase: "roofing", description: "Drainage system installed", descriptionJa: "排水設備設置", required: true },
    { phase: "roofing", description: "Leak test passed", descriptionJa: "漏水テスト合格", required: false },
  ],
  exterior: [
    { phase: "exterior", description: "Insulation installed", descriptionJa: "断熱材施工", required: true },
    { phase: "exterior", description: "Exterior cladding installed", descriptionJa: "外壁材施工", required: true },
    { phase: "exterior", description: "Windows and doors installed", descriptionJa: "建具取付完了", required: true },
    { phase: "exterior", description: "Sealant and caulking applied", descriptionJa: "シーリング施工", required: true },
    { phase: "exterior", description: "Exterior painting completed", descriptionJa: "外壁塗装完了", required: false },
    { phase: "exterior", description: "Scaffolding removed", descriptionJa: "足場解体", required: false },
  ],
  interior: [
    { phase: "interior", description: "Electrical rough-in completed", descriptionJa: "電気配線工事完了", required: true },
    { phase: "interior", description: "Plumbing rough-in completed", descriptionJa: "給排水配管工事完了", required: true },
    { phase: "interior", description: "HVAC installation completed", descriptionJa: "空調設備設置完了", required: true },
    { phase: "interior", description: "Insulation and vapor barrier installed", descriptionJa: "断熱・防湿施工", required: true },
    { phase: "interior", description: "Drywall/plasterboard installed", descriptionJa: "ボード張り完了", required: true },
    { phase: "interior", description: "Flooring installed", descriptionJa: "床材施工完了", required: false },
  ],
  finishing: [
    { phase: "finishing", description: "Interior painting completed", descriptionJa: "内装塗装完了", required: true },
    { phase: "finishing", description: "Fixtures and fittings installed", descriptionJa: "器具取付完了", required: true },
    { phase: "finishing", description: "Kitchen and bathroom fixtures set", descriptionJa: "キッチン・浴室設置", required: true },
    { phase: "finishing", description: "Final electrical connections", descriptionJa: "電気最終接続", required: true },
    { phase: "finishing", description: "Final plumbing connections", descriptionJa: "給排水最終接続", required: true },
    { phase: "finishing", description: "Cleaning completed", descriptionJa: "美装クリーニング完了", required: false },
  ],
  inspection: [
    { phase: "inspection", description: "Building code compliance verified", descriptionJa: "建築基準法適合確認", required: true },
    { phase: "inspection", description: "Fire safety inspection passed", descriptionJa: "消防検査合格", required: true },
    { phase: "inspection", description: "Electrical inspection passed", descriptionJa: "電気検査合格", required: true },
    { phase: "inspection", description: "Plumbing inspection passed", descriptionJa: "給排水検査合格", required: true },
    { phase: "inspection", description: "Final walkthrough completed", descriptionJa: "竣工検査完了", required: true },
    { phase: "inspection", description: "Certificate of occupancy obtained", descriptionJa: "検査済証取得", required: true },
    { phase: "inspection", description: "As-built drawings delivered", descriptionJa: "竣工図書引渡し", required: false },
  ],
};

/**
 * Get the standard checklist items for a given construction phase.
 * Each item gets a unique id based on phase and index.
 */
export function getPhaseChecklist(phase: ConstructionPhase): ChecklistItem[] {
  const items = PHASE_CHECKLISTS[phase];
  if (!items) return [];

  return items.map((item, index) => ({
    ...item,
    id: `${phase}-${String(index + 1).padStart(2, "0")}`,
  }));
}

export type PhaseCompletionResult = {
  phase: ConstructionPhase;
  phaseLabel: string;
  totalItems: number;
  completedCount: number;
  requiredTotal: number;
  requiredCompleted: number;
  percentage: number;
  passed: boolean;
};

/**
 * Evaluate phase completion based on completed item IDs.
 * Pass requires all required items to be completed.
 */
export function evaluatePhaseCompletion(
  phase: ConstructionPhase,
  completedItemIds: string[],
): PhaseCompletionResult {
  const checklist = getPhaseChecklist(phase);
  const completedSet = new Set(completedItemIds);

  const totalItems = checklist.length;
  const completedCount = checklist.filter((item) => completedSet.has(item.id)).length;
  const requiredItems = checklist.filter((item) => item.required);
  const requiredTotal = requiredItems.length;
  const requiredCompleted = requiredItems.filter((item) => completedSet.has(item.id)).length;

  const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const passed = requiredCompleted === requiredTotal;

  return {
    phase,
    phaseLabel: getPhaseLabel(phase),
    totalItems,
    completedCount,
    requiredTotal,
    requiredCompleted,
    percentage,
    passed,
  };
}
