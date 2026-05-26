/**
 * proposal-composer — ProposalDocument を組み立てる
 *
 * LLM 不使用。決定的テンプレート + プレースホルダー差し込み。
 */

import type {
  ProposalDocument,
  ProposalSection,
  ProposalGenerationInput,
  ProposalGenerationOptions,
  LaportaStrength,
  CaseStudy,
  DifferentiationPoint,
} from "./types.js";
import { buildPriceRange, formatManYen } from "./price-builder.js";
import { buildSchedule } from "./schedule-builder.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function validUntilDate(fromIso: string, daysAfter = 30): string {
  const dt = new Date(fromIso);
  dt.setDate(dt.getDate() + daysAfter);
  return dt.toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${y}年${m}月${d}日`;
}

const CATEGORY_LABEL_JA: Record<string, string> = {
  kitchen: "キッチン工事",
  bath: "浴室工事",
  store_fit: "店舗内装工事",
  office_fit: "オフィス内装工事",
  full_renovation: "全面リノベーション",
  partial_renovation: "部分リフォーム",
  exterior: "外装・外壁工事",
  repair: "補修・修繕工事",
  other: "その他内装工事",
};

const SCALE_LABEL_JA: Record<string, string> = {
  small: "小規模",
  medium: "中規模",
  large: "大規模",
  extra_large: "超大規模",
};

// ── Section builders ───────────────────────────────────────────────────────

function buildCoverSection(input: ProposalGenerationInput, generatedAt: string): ProposalSection {
  const vars = {
    customerName: input.customerName,
    workCategory: CATEGORY_LABEL_JA[input.workCategory] ?? input.workCategory,
    locationCity: input.locationCity,
    dateJa: formatDate(generatedAt),
  };
  return {
    kind: "cover",
    titleJa: "ご提案書",
    bodyJa: fill(
      "{{customerName}} 様\n\nこのたびは株式会社ラポルタにお声がけいただき、誠にありがとうございます。\n{{locationCity}}での{{workCategory}}に関するご提案書をご用意いたしました。\n\n作成日: {{dateJa}}\n株式会社ラポルタ　代表 新山光輝",
      vars,
    ),
    orderIndex: 0,
  };
}

function buildExecutiveSummarySection(
  input: ProposalGenerationInput,
  priceRange: { lower: number; upper: number },
  durationDays: number,
): ProposalSection {
  const vars = {
    customerName: input.customerName,
    workCategory: CATEGORY_LABEL_JA[input.workCategory] ?? input.workCategory,
    locationCity: input.locationCity,
    lowerManYen: formatManYen(priceRange.lower),
    upperManYen: formatManYen(priceRange.upper),
    durationDays: String(durationDays),
  };
  return {
    kind: "executive_summary",
    titleJa: "ご提案の概要",
    bodyJa: fill(
      "{{customerName}} 様の{{locationCity}}における{{workCategory}}について、ラポルタが責任を持って対応させていただきます。\n\n概算工事費: {{lowerManYen}} 〜 {{upperManYen}} (税込・現地調査前の概算)\n標準工期: {{durationDays}}日間 (着工日から引渡まで)\n\n本提案書は現地調査前の初回叩き台です。現地調査後に精度の高いお見積りをご提示します。",
      vars,
    ),
    callouts: [
      `概算工事費: ${formatManYen(priceRange.lower)} 〜 ${formatManYen(priceRange.upper)}`,
      `標準工期: ${durationDays}日間`,
      "10年アフター保証 標準付帯",
    ],
    orderIndex: 1,
  };
}

function buildCustomerSituationSection(input: ProposalGenerationInput): ProposalSection {
  const vars = {
    customerName: input.customerName,
    workCategory: CATEGORY_LABEL_JA[input.workCategory] ?? input.workCategory,
    scale: SCALE_LABEL_JA[input.workScale] ?? input.workScale,
    locationCity: input.locationCity,
    budgetNote: input.budgetHintJpy
      ? `ご予算ヒント: ${formatManYen(input.budgetHintJpy)}`
      : "ご予算は現地調査後に詳細確認",
    startNote: input.desiredStartMonth
      ? `希望着工: ${input.desiredStartMonth}月頃`
      : "着工時期はご相談の上決定",
  };
  return {
    kind: "customer_situation",
    titleJa: "お客様のご状況・ご要望",
    bodyJa: fill(
      "工事種別: {{workCategory}} ({{scale}})\n対象エリア: {{locationCity}}\n{{budgetNote}}\n{{startNote}}\n\n上記ご要望をもとに、最適なプランをご提案いたします。",
      vars,
    ),
    orderIndex: 2,
  };
}

function buildOurStrengthsSection(strengths: LaportaStrength[]): ProposalSection {
  const bodyParts = strengths.map((s, i) => {
    const evidenceNote = s.evidence ? `\n  根拠: ${s.evidence}` : "";
    return `${i + 1}. **${s.titleJa}**\n  ${s.bodyJa}${evidenceNote}`;
  });
  return {
    kind: "our_strengths",
    titleJa: "ラポルタが選ばれる理由",
    bodyJa: bodyParts.join("\n\n"),
    callouts: strengths.map((s) => s.titleJa),
    orderIndex: 3,
  };
}

function buildCaseStudiesSection(cases: CaseStudy[]): ProposalSection {
  const bodyParts = cases.map((c, i) => {
    const voice = c.customerVoiceJa ? `\n  お客様の声: "${c.customerVoiceJa}"` : "";
    return `${i + 1}. **${c.anonymizedClient}** (${c.completedYearMonth.replace("-", "年")}月完工)\n  ${c.summaryJa}\n  実績: ${c.achievementJa}${voice}`;
  });
  return {
    kind: "case_studies",
    titleJa: "類似施工事例",
    bodyJa:
      bodyParts.length > 0
        ? bodyParts.join("\n\n")
        : "現在、類似事例を収集中です。担当者よりお伺いします。",
    callouts: cases.map((c) => `${c.anonymizedClient}: ${c.achievementJa}`),
    orderIndex: 4,
  };
}

function buildPriceRangeSection(
  priceRange: { lower: number; upper: number; basisJa: string },
): ProposalSection {
  return {
    kind: "price_range",
    titleJa: "概算工事費",
    bodyJa: `概算工事費レンジ (税込): ${formatManYen(priceRange.lower)} 〜 ${formatManYen(priceRange.upper)}\n\n${priceRange.basisJa}\n\n※ 現地調査後に精査した正式お見積りをご提示します。\n※ 材料コストデータベースによる最適調達で、同品質なら他社比8〜15%のコスト削減を実現します。`,
    callouts: [
      `下限: ${formatManYen(priceRange.lower)}`,
      `上限: ${formatManYen(priceRange.upper)}`,
    ],
    orderIndex: 5,
  };
}

function buildScheduleSection(
  schedule: { durationDays: number; phasesJa: string[] },
): ProposalSection {
  const phaseList = schedule.phasesJa.map((p) => `  - ${p}`).join("\n");
  return {
    kind: "schedule",
    titleJa: "工程・スケジュール",
    bodyJa: `標準工期: ${schedule.durationDays}日間\n\n工程:\n${phaseList}\n\n※ 実際の工期は現地調査・着工日・天候等により変動します。`,
    callouts: [`標準工期 ${schedule.durationDays}日間`],
    orderIndex: 6,
  };
}

function buildDifferentiationSection(points: DifferentiationPoint[]): ProposalSection {
  const bodyParts = points.map((p) => {
    return `**【${p.axisJa}】**\n- ラポルタ: ${p.laportaPositionJa}\n- 競合他社: ${p.competitorPositionJa}\n- 優位性: ${p.advantageJa}`;
  });
  return {
    kind: "differentiation",
    titleJa: "競合との差別化ポイント",
    bodyJa:
      bodyParts.length > 0
        ? bodyParts.join("\n\n")
        : "各軸での差別化ポイントは別途ご説明いたします。",
    callouts: points.map((p) => p.axisJa),
    orderIndex: 7,
  };
}

function buildNextStepSection(): ProposalSection {
  return {
    kind: "next_step",
    titleJa: "次のステップ",
    bodyJa:
      "1. **現地調査・ヒアリング** — 担当者が現地を拝見し、詳細なお見積りに向けてヒアリングを行います。\n2. **3D完成イメージのご提示** — AIを用いた完成イメージを作成し、素材・色・レイアウトをご一緒に確認します。\n3. **正式お見積りのご提出** — 現地調査後 3営業日以内に正式見積書をご提出します。\n4. **ご契約** — 内容にご納得いただいた上でご契約。着工日を確定します。\n\nまずは現地調査のご日程をご相談ください。",
    orderIndex: 8,
  };
}

function buildAppendixSection(): ProposalSection {
  return {
    kind: "appendix",
    titleJa: "会社概要・資格・保証",
    bodyJa:
      "■ 会社概要\n株式会社ラポルタ\n設立: 1999年\n所在地: 東京都世田谷区\n代表: 新山光輝\n\n■ 主な資格\n・建設業許可 (内装仕上工事業、塗装工事業)\n・1級建築施工管理技士\n・一級建築士\n\n■ 保証内容\n・施工後10年間無償補修保証 (標準)\n・24時間緊急連絡対応\n・定期点検 (1年目・3年目・5年目)\n\n■ 対応エリア\n東京都全域 / 神奈川県一部",
    orderIndex: 9,
  };
}

// ── Dependencies type ──────────────────────────────────────────────────────

export type ComposerDeps = {
  strengths: LaportaStrength[];
  cases: CaseStudy[];
  diffPoints: DifferentiationPoint[];
};

// ── Public API ─────────────────────────────────────────────────────────────

let _idCounter = 0;

export function _resetComposerIdCounter(): void {
  _idCounter = 0;
}

function generateDocId(): string {
  return `prop-${Date.now()}-${++_idCounter}`;
}

/**
 * 全セクションを組み立てて ProposalDocument を返す。
 */
export function compose(
  input: ProposalGenerationInput,
  opts: ProposalGenerationOptions,
  deps: ComposerDeps,
): ProposalDocument {
  const generatedAt = new Date().toISOString();
  const priceRange = buildPriceRange(input);
  const schedule = buildSchedule(input);

  const sections: ProposalSection[] = [
    buildCoverSection(input, generatedAt),
    buildExecutiveSummarySection(input, priceRange, schedule.durationDays),
    buildCustomerSituationSection(input),
    buildOurStrengthsSection(deps.strengths),
  ];

  if (opts.includeCases) {
    sections.push(buildCaseStudiesSection(deps.cases));
  }

  sections.push(
    buildPriceRangeSection(priceRange),
    buildScheduleSection(schedule),
  );

  if (opts.includeDifferentiation) {
    sections.push(buildDifferentiationSection(deps.diffPoints));
  }

  sections.push(buildNextStepSection(), buildAppendixSection());

  return {
    id: generateDocId(),
    dealId: input.dealId,
    inquiryId: input.inquiryId,
    customerName: input.customerName,
    generatedAt,
    sections,
    totalPriceJpyLower: priceRange.lower,
    totalPriceJpyUpper: priceRange.upper,
    durationDays: schedule.durationDays,
    validUntil: validUntilDate(generatedAt, 30),
  };
}
