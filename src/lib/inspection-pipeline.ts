/**
 * 検査→報告書一気通貫パイプライン — 現場Plus蒸留
 * 検査員がタブレットで記録した結果から報告書を自動生成する。
 */
import { escapeHtml } from "./utils/escape-html";
import { createRepository } from "./repository/index.js";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type InspectionCheckItem = {
  id: string;
  category: string;
  checkPoint: string;
  standard: string;
  result: "pass" | "fail" | "na" | "pending";
  value?: string;
  photoIds?: string[];
  note?: string;
};

export type InspectionType =
  | "finish"
  | "structural"
  | "mep"
  | "waterproof"
  | "fire"
  | "safety";

export type InspectionRecord = {
  id: string;
  projectId: string;
  inspectionType: InspectionType;
  location: string;
  floor?: number;
  room?: string;
  inspector: string;
  inspectedAt: Date;
  items: InspectionCheckItem[];
  overallResult: "pass" | "conditional" | "fail";
  conditions?: string[];
};

export type InspectionReportConfig = {
  title: string;
  companyName: string;
  projectName: string;
  includeSummary: boolean;
  includePhotos: boolean;
  includeStatistics: boolean;
  signatureFields: string[];
};

// ── 統計型 ────────────────────────────────────────────────────────────────────

export type InspectionItemStats = {
  pass: number;
  fail: number;
  na: number;
  pending: number;
  total: number;
  passRate: number; // pass / (pass + fail) or 1 if no graded items
};

export type ProjectInspectionStats = {
  totalInspections: number;
  passRateByType: Record<InspectionType, number>;
  commonFailurePoints: Array<{ checkPoint: string; failCount: number }>;
};

export type FailureHotspot = {
  checkPoint: string;
  category: string;
  failCount: number;
  locations: string[];
  floors: number[];
};

// ── チェックリストテンプレート ─────────────────────────────────────────────────

type ChecklistTemplate = Array<{
  category: string;
  checkPoint: string;
  standard: string;
}>;

const FINISH_TEMPLATE: ChecklistTemplate = [
  { category: "壁仕上", checkPoint: "クロス浮き・剥がれ", standard: "浮き・剥がれなし" },
  { category: "壁仕上", checkPoint: "クロスジョイント", standard: "隙間・重なり均一" },
  { category: "壁仕上", checkPoint: "出隅・入隅処理", standard: "コーナー直角・隙間なし" },
  { category: "壁仕上", checkPoint: "パテ跡", standard: "透け・凹凸なし" },
  { category: "天井仕上", checkPoint: "天井クロス状態", standard: "浮き・シワなし" },
  { category: "天井仕上", checkPoint: "廻り縁処理", standard: "隙間・段差なし" },
  { category: "天井仕上", checkPoint: "点検口取付", standard: "水平・ガタなし" },
  { category: "床仕上", checkPoint: "フローリングレベル", standard: "水平・踏み沈みなし" },
  { category: "床仕上", checkPoint: "フローリング隙間", standard: "隙間均一・反りなし" },
  { category: "床仕上", checkPoint: "タイル目地", standard: "目地幅均一・充填十分" },
  { category: "巾木", checkPoint: "巾木取付状態", standard: "密着・コーナー合わせ正確" },
  { category: "建具", checkPoint: "建具開閉動作", standard: "スムーズ・ガタなし" },
  { category: "建具", checkPoint: "建具隙間・召し合わせ", standard: "均一・密着" },
  { category: "塗装", checkPoint: "塗装ムラ・タレ", standard: "均一・タレなし" },
  { category: "塗装", checkPoint: "見切り処理", standard: "直線・はみ出しなし" },
  { category: "設備", checkPoint: "スイッチ・コンセント廻り", standard: "プレート密着・切込み正確" },
  { category: "設備", checkPoint: "照明器具取付", standard: "水平・がたなし" },
];

const STRUCTURAL_TEMPLATE: ChecklistTemplate = [
  { category: "配筋", checkPoint: "主筋径・本数", standard: "設計図通り" },
  { category: "配筋", checkPoint: "配筋ピッチ", standard: "設計値±10mm以内" },
  { category: "配筋", checkPoint: "かぶり厚", standard: "設計値以上" },
  { category: "配筋", checkPoint: "継手・定着長さ", standard: "規定値以上" },
  { category: "型枠", checkPoint: "型枠精度・垂直", standard: "垂直±3mm以内" },
  { category: "型枠", checkPoint: "型枠締付・漏れ防止", standard: "隙間なし・緊結良好" },
  { category: "コンクリ打設", checkPoint: "スランプ値", standard: "指定値±2.5cm以内" },
  { category: "コンクリ打設", checkPoint: "打設温度", standard: "5℃以上35℃以下" },
  { category: "コンクリ打設", checkPoint: "バイブレーター使用", standard: "適切な間隔で使用" },
  { category: "鉄骨", checkPoint: "高力ボルト締付", standard: "トルク値規定以上" },
  { category: "鉄骨", checkPoint: "溶接ビード", standard: "アンダーカット・クレーターなし" },
  { category: "鉄骨", checkPoint: "建て入れ精度", standard: "垂直±H/1000以内" },
];

const MEP_TEMPLATE: ChecklistTemplate = [
  { category: "配管", checkPoint: "配管径・材種", standard: "設計図通り" },
  { category: "配管", checkPoint: "配管勾配", standard: "排水1/100以上" },
  { category: "配管", checkPoint: "配管支持間隔", standard: "規定以内・良好" },
  { category: "配管", checkPoint: "水圧試験", standard: "規定圧力で漏れなし" },
  { category: "配線", checkPoint: "電線径・種別", standard: "設計図通り" },
  { category: "配線", checkPoint: "電線管・ラック施工", standard: "固定良好・経路適切" },
  { category: "配線", checkPoint: "絶縁抵抗値", standard: "1MΩ以上" },
  { category: "配線", checkPoint: "接地工事", standard: "規定接地抵抗以下" },
  { category: "器具", checkPoint: "衛生器具取付", standard: "水平・固定良好・漏れなし" },
  { category: "器具", checkPoint: "電気器具取付", standard: "固定良好・カバー完全" },
  { category: "試運転", checkPoint: "給水系統試運転", standard: "規定水量・圧力" },
  { category: "試運転", checkPoint: "排水系統試運転", standard: "詰まり・逆流なし" },
  { category: "試運転", checkPoint: "電気系統動作確認", standard: "全回路正常動作" },
];

const WATERPROOF_TEMPLATE: ChecklistTemplate = [
  { category: "防水層", checkPoint: "防水材種別確認", standard: "設計図指定品" },
  { category: "防水層", checkPoint: "防水層塗布厚", standard: "規定厚以上" },
  { category: "防水層", checkPoint: "防水層状態", standard: "気泡・ピンホールなし" },
  { category: "防水層", checkPoint: "立上り防水高さ", standard: "150mm以上" },
  { category: "シーリング", checkPoint: "シーリング材種別", standard: "設計図指定品" },
  { category: "シーリング", checkPoint: "シーリング幅・深さ", standard: "10×10mm以上" },
  { category: "シーリング", checkPoint: "シーリング接着状態", standard: "剥離・切れなし" },
  { category: "水張試験", checkPoint: "水張試験（24時間）", standard: "漏水なし" },
];

const FIRE_TEMPLATE: ChecklistTemplate = [
  { category: "耐火被覆", checkPoint: "耐火被覆厚", standard: "規定厚以上" },
  { category: "耐火被覆", checkPoint: "耐火被覆状態", standard: "剥落・欠損なし" },
  { category: "防火区画", checkPoint: "防火区画貫通処理", standard: "防火材充填完全" },
  { category: "防火区画", checkPoint: "防火戸取付", standard: "自動閉鎖・隙間なし" },
  { category: "スプリンクラー", checkPoint: "SPヘッド取付位置", standard: "設計図通り" },
  { category: "スプリンクラー", checkPoint: "SP配管耐圧試験", standard: "規定圧力で漏れなし" },
  { category: "感知器", checkPoint: "感知器取付位置", standard: "規定間隔以内" },
  { category: "感知器", checkPoint: "感知器動作確認", standard: "正常作動" },
];

const SAFETY_TEMPLATE: ChecklistTemplate = [
  { category: "足場", checkPoint: "足場組立状態", standard: "緊結良好・水平" },
  { category: "足場", checkPoint: "手すり設置", standard: "高さ900mm以上" },
  { category: "足場", checkPoint: "幅木設置", standard: "高さ150mm以上" },
  { category: "墜落防止", checkPoint: "安全ネット設置", standard: "開口部全面" },
  { category: "墜落防止", checkPoint: "開口部養生", standard: "蓋・手すり設置" },
  { category: "保護具", checkPoint: "ヘルメット着用", standard: "全員着用" },
  { category: "保護具", checkPoint: "安全帯使用", standard: "2m以上は必着" },
  { category: "整理整頓", checkPoint: "通路確保", standard: "600mm以上確保" },
  { category: "整理整頓", checkPoint: "資材整理状態", standard: "所定場所に整頓" },
];

const TEMPLATES: Record<InspectionType, ChecklistTemplate> = {
  finish: FINISH_TEMPLATE,
  structural: STRUCTURAL_TEMPLATE,
  mep: MEP_TEMPLATE,
  waterproof: WATERPROOF_TEMPLATE,
  fire: FIRE_TEMPLATE,
  safety: SAFETY_TEMPLATE,
};

// ── ラベル ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InspectionType, string> = {
  finish: "仕上検査",
  structural: "構造検査",
  mep: "設備検査",
  waterproof: "防水検査",
  fire: "防火検査",
  safety: "安全検査",
};

const RESULT_LABELS: Record<"pass" | "fail" | "na" | "pending", string> = {
  pass: "合格",
  fail: "不合格",
  na: "—",
  pending: "未確認",
};

const RESULT_COLORS: Record<"pass" | "fail" | "na" | "pending", string> = {
  pass: "#6f916c",
  fail: "#ef4444",
  na: "#94a3b8",
  pending: "#f59e0b",
};

const OVERALL_LABELS: Record<"pass" | "conditional" | "fail", string> = {
  pass: "合格",
  conditional: "条件付合格",
  fail: "不合格",
};

const OVERALL_COLORS: Record<"pass" | "conditional" | "fail", string> = {
  pass: "#6f916c",
  conditional: "#f59e0b",
  fail: "#ef4444",
};

// ── コア関数 ──────────────────────────────────────────────────────────────────

/**
 * 検査種別と場所からチェックリストを生成する。
 * 各項目は result: 'pending' で初期化される。
 */
export function createInspectionChecklist(
  type: InspectionType,
  location: string,
): InspectionRecord {
  const template = TEMPLATES[type];
  const items: InspectionCheckItem[] = template.map((t) => ({
    id: crypto.randomUUID(),
    category: t.category,
    checkPoint: t.checkPoint,
    standard: t.standard,
    result: "pending" as const,
  }));

  return {
    id: crypto.randomUUID(),
    projectId: "",
    inspectionType: type,
    location,
    inspector: "",
    inspectedAt: new Date(),
    items,
    overallResult: "conditional",
  };
}

/**
 * 個別項目の結果から総合判定を自動計算する。
 * - fail が1件でも → fail
 * - pass が1件以上あり fail が0 → pass
 * - それ以外（全て na/pending）→ conditional
 */
export function evaluateInspection(
  record: InspectionRecord,
): InspectionRecord {
  const { items } = record;
  const hasFail = items.some((i) => i.result === "fail");
  const hasPass = items.some((i) => i.result === "pass");

  let overallResult: "pass" | "conditional" | "fail";
  if (hasFail) {
    overallResult = "fail";
  } else if (hasPass) {
    overallResult = "pass";
  } else {
    overallResult = "conditional";
  }

  return { ...record, overallResult, items: [...items] };
}

/**
 * 印刷可能なHTML検査報告書を生成する。A4印刷対応のCSSを含む。
 */
export function generateInspectionReport(
  record: InspectionRecord,
  config: InspectionReportConfig,
): string {
  const stats = computeItemStats(record.items);
  const passRate = Math.round(stats.passRate * 100);

  const formattedDate = record.inspectedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // サマリー統計
  const summaryHtml = config.includeSummary
    ? `<div class="summary-bar">
    <div class="summary-item pass"><span class="label">合格:</span><span class="value">${stats.pass}件</span></div>
    <div class="summary-item fail"><span class="label">不合格:</span><span class="value">${stats.fail}件</span></div>
    <div class="summary-item na"><span class="label">対象外:</span><span class="value">${stats.na}件</span></div>
    <div class="summary-item pending"><span class="label">未確認:</span><span class="value">${stats.pending}件</span></div>
  </div>`
    : "";

  const statisticsHtml = config.includeStatistics
    ? `<div class="stats-box">
    <div class="stats-title">合格率</div>
    <div class="stats-rate" style="color:${OVERALL_COLORS[record.overallResult]}">${passRate}%</div>
    <div class="stats-label">（${stats.pass}/${stats.pass + stats.fail}件合格）</div>
  </div>`
    : "";

  // 詳細テーブル
  const rowsHtml =
    record.items.length > 0
      ? record.items
          .map(
            (item, idx) =>
              `<tr${item.result === "fail" ? ' style="background:#fef2f2;"' : ""}>
            <td style="text-align:center">${idx + 1}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.checkPoint)}</td>
            <td>${escapeHtml(item.standard)}</td>
            <td style="text-align:center;font-weight:700;color:${RESULT_COLORS[item.result]}">${RESULT_LABELS[item.result]}</td>
            ${config.includePhotos ? `<td style="text-align:center">${item.photoIds && item.photoIds.length > 0 ? `[写真${item.photoIds.length}枚]` : "—"}</td>` : ""}
            <td>${escapeHtml(item.note || "—")}</td>
          </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="${config.includePhotos ? 7 : 6}" style="text-align:center;color:#94a3b8">検査項目なし</td></tr>`;

  // 写真ヘッダー列
  const photoHeader = config.includePhotos
    ? `<th style="width:80px">写真</th>`
    : "";

  // 署名欄
  const signaturesHtml =
    config.signatureFields.length > 0
      ? `<div class="signatures">
    ${config.signatureFields
      .map(
        (field) =>
          `<div class="sig-field">
      <div class="sig-label">${escapeHtml(field)}</div>
      <div class="sig-line"></div>
    </div>`,
      )
      .join("\n")}
  </div>`
      : "";

  const locationDisplay = [
    record.location,
    record.floor !== undefined ? `${record.floor}F` : null,
    record.room ?? null,
  ]
    .filter(Boolean)
    .join(" / ");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(config.title)} - ${escapeHtml(config.projectName)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; font-size: 0.9em; }
    .meta-item .label { color: #64748b; }
    .meta-item .value { font-weight: 600; }
    .overall { display: inline-block; padding: 4px 14px; border-radius: 4px; font-weight: 700; font-size: 1.1em; margin-bottom: 12px; }
    .summary-bar { display: flex; gap: 2em; margin-bottom: 12px; padding: 8px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.9em; }
    .summary-item .label { color: #64748b; }
    .summary-item .value { font-weight: 700; margin-left: 4px; }
    .summary-item.pass .value { color: #6f916c; }
    .summary-item.fail .value { color: #ef4444; }
    .summary-item.na .value { color: #94a3b8; }
    .summary-item.pending .value { color: #f59e0b; }
    .stats-box { float: right; text-align: center; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 16px; margin: 0 0 12px 16px; }
    .stats-title { font-size: 0.8em; color: #64748b; }
    .stats-rate { font-size: 2em; font-weight: 700; }
    .stats-label { font-size: 0.8em; color: #64748b; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; clear: both; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    .signatures { display: flex; gap: 3em; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .sig-field { flex: 1; }
    .sig-label { font-size: 0.85em; color: #64748b; margin-bottom: 24px; }
    .sig-line { border-bottom: 1px solid #333; height: 24px; }
    @page { size: A4; margin: 15mm; }
    @media print { body { margin: 0; } .stats-box { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(config.title)}</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">会社名: </span><span class="value">${escapeHtml(config.companyName)}</span></div>
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(config.projectName)}</span></div>
    <div class="meta-item"><span class="label">検査種別: </span><span class="value">${escapeHtml(TYPE_LABELS[record.inspectionType])}</span></div>
    <div class="meta-item"><span class="label">場所: </span><span class="value">${escapeHtml(locationDisplay)}</span></div>
    <div class="meta-item"><span class="label">検査員: </span><span class="value">${escapeHtml(record.inspector)}</span></div>
    <div class="meta-item"><span class="label">検査日: </span><span class="value">${escapeHtml(formattedDate)}</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  <div class="overall" style="background:${OVERALL_COLORS[record.overallResult]}1a;color:${OVERALL_COLORS[record.overallResult]};border:1px solid ${OVERALL_COLORS[record.overallResult]}">
    総合判定: ${escapeHtml(OVERALL_LABELS[record.overallResult])}
  </div>
  ${statisticsHtml}
  ${summaryHtml}
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th style="width:90px">カテゴリ</th>
        <th>確認項目</th>
        <th>判定基準</th>
        <th style="width:70px">結果</th>
        ${photoHeader}
        <th>備考</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  ${signaturesHtml}
</body>
</html>`;
}

/**
 * 複数の検査記録からプロジェクト横断の統計を集計する。
 */
export function getInspectionStatsByProject(
  records: InspectionRecord[],
): ProjectInspectionStats {
  const totalInspections = records.length;

  // 種別ごとの合格率
  const passRateByType = {} as Record<InspectionType, number>;
  const types: InspectionType[] = ["finish", "structural", "mep", "waterproof", "fire", "safety"];
  for (const type of types) {
    const ofType = records.filter((r) => r.inspectionType === type);
    if (ofType.length === 0) {
      passRateByType[type] = 1;
    } else {
      const passed = ofType.filter((r) => r.overallResult === "pass").length;
      passRateByType[type] = passed / ofType.length;
    }
  }

  // よくある不合格チェックポイント
  const failCounts = new Map<string, number>();
  for (const record of records) {
    for (const item of record.items) {
      if (item.result === "fail") {
        failCounts.set(item.checkPoint, (failCounts.get(item.checkPoint) ?? 0) + 1);
      }
    }
  }
  const commonFailurePoints = [...failCounts.entries()]
    .map(([checkPoint, failCount]) => ({ checkPoint, failCount }))
    .sort((a, b) => b.failCount - a.failCount);

  return { totalInspections, passRateByType, commonFailurePoints };
}

/**
 * 繰り返し不合格となる箇所（ホットスポット）を特定する。
 */
export function getFailureHotspots(records: InspectionRecord[]): FailureHotspot[] {
  const map = new Map<
    string,
    { category: string; failCount: number; locationSet: Set<string>; floorSet: Set<number> }
  >();

  for (const record of records) {
    for (const item of record.items) {
      if (item.result !== "fail") continue;
      const existing = map.get(item.checkPoint);
      if (existing) {
        existing.failCount += 1;
        existing.locationSet.add(record.location);
        if (record.floor !== undefined) existing.floorSet.add(record.floor);
      } else {
        map.set(item.checkPoint, {
          category: item.category,
          failCount: 1,
          locationSet: new Set([record.location]),
          floorSet: record.floor !== undefined ? new Set([record.floor]) : new Set(),
        });
      }
    }
  }

  return [...map.entries()]
    .map(([checkPoint, data]) => ({
      checkPoint,
      category: data.category,
      failCount: data.failCount,
      locations: [...data.locationSet],
      floors: [...data.floorSet].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.failCount - a.failCount);
}

/**
 * 不合格項目を抽出して再検査チェックリストを生成する。
 */
export function buildReinspectionList(record: InspectionRecord): InspectionRecord {
  const failedItems = record.items
    .filter((i) => i.result === "fail")
    .map((i) => ({
      ...i,
      id: crypto.randomUUID(),
      result: "pending" as const,
      note: i.note ? `[再検査] ${i.note}` : "[再検査]",
    }));

  return {
    id: crypto.randomUUID(),
    projectId: record.projectId,
    inspectionType: record.inspectionType,
    location: record.location,
    floor: record.floor,
    room: record.room,
    inspector: record.inspector,
    inspectedAt: new Date(),
    items: failedItems,
    overallResult: "conditional",
  };
}

/**
 * 同一場所の2回の検査を比較する（是正確認用）。
 * 項目は checkPoint でマッチング。
 */
export type InspectionComparison = {
  checkPoint: string;
  category: string;
  beforeResult: "pass" | "fail" | "na" | "pending";
  afterResult: "pass" | "fail" | "na" | "pending" | "removed";
  improved: boolean; // fail → pass
  regressed: boolean; // pass → fail
};

export function compareInspections(
  before: InspectionRecord,
  after: InspectionRecord,
): InspectionComparison[] {
  const afterMap = new Map(after.items.map((i) => [i.checkPoint, i]));

  return before.items.map((beforeItem) => {
    const afterItem = afterMap.get(beforeItem.checkPoint);
    const afterResult = afterItem ? afterItem.result : ("removed" as const);
    const improved =
      beforeItem.result === "fail" && afterResult === "pass";
    const regressed =
      beforeItem.result === "pass" && afterResult === "fail";

    return {
      checkPoint: beforeItem.checkPoint,
      category: beforeItem.category,
      beforeResult: beforeItem.result,
      afterResult,
      improved,
      regressed,
    };
  });
}

// ── 内部ヘルパー ──────────────────────────────────────────────────────────────

function computeItemStats(items: InspectionCheckItem[]): InspectionItemStats {
  const pass = items.filter((i) => i.result === "pass").length;
  const fail = items.filter((i) => i.result === "fail").length;
  const na = items.filter((i) => i.result === "na").length;
  const pending = items.filter((i) => i.result === "pending").length;
  const total = items.length;
  const graded = pass + fail;
  const passRate = graded > 0 ? pass / graded : 1;

  return { pass, fail, na, pending, total, passRate };
}

// Repository-pattern accessor (for gradual migration to Supabase)
export const inspectionRecordRepository = createRepository<InspectionRecord>('inspection_records');
