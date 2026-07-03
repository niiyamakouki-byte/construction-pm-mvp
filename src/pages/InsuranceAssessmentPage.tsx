import { useState } from "react";
import { assessDamage, type AssessmentInput, type AssessmentResult } from "../lib/insurance_ai_drone/assessor.js";
import { assessDroneImages, type DronePhotoMeta, type DroneAssessmentResult } from "../lib/insurance_ai_drone/drone_assessor.js";
import { calculatePml, type PmlInput, type PmlResult, type StructureType, type SeismicGrade } from "../lib/insurance_ai_drone/pml.js";
import {
  getRecommendedPlan,
  getAllPlans,
  formatPlanPrice,
  type TargetSegment,
  type InsurancePlan,
} from "../lib/insurance_ai_drone/pricing.js";
import type { DamageType } from "../lib/insurance_ai_drone/rules/insurance_clauses.js";

// ── Labels ────────────────────────────────────────────────────────────────

const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  fire: "火災",
  water: "水濡れ",
  theft: "盗難",
  earthquake: "地震",
  third_party: "第三者賠償",
};

const STRUCTURE_LABELS: Record<StructureType, string> = {
  wood: "木造",
  light_steel: "軽量鉄骨造",
  steel: "鉄骨造",
  src: "SRC造",
  rc: "RC造",
};

const SEISMIC_LABELS: Record<SeismicGrade, string> = {
  pre_1981: "旧耐震 (1981年以前)",
  standard_1981: "新耐震 (1981〜2000年)",
  enhanced_2000: "2000年基準以降",
};

const SEGMENT_LABELS: Record<TargetSegment, string> = {
  general_contractor: "元請",
  insurance_agent: "代理店",
  loss_adjuster: "損害調査",
  risk_manager: "リスクマネジメント",
};

const RISK_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  very_low: { bg: "bg-emerald-50", text: "text-emerald-700", label: "極低リスク" },
  low: { bg: "bg-green-50", text: "text-green-700", label: "低リスク" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", label: "中リスク" },
  high: { bg: "bg-orange-50", text: "text-orange-700", label: "高リスク" },
  very_high: { bg: "bg-red-50", text: "text-red-700", label: "超高リスク" },
};

const PLAN_STYLES: Record<string, string> = {
  starter: "border-slate-200",
  professional: "border-blue-300",
  enterprise: "border-amber-400",
};

// ── Tab type ──────────────────────────────────────────────────────────────

type Tab = "assessment" | "drone" | "pml" | "pricing";

const TAB_DEFS: { key: Tab; label: string; icon: string }[] = [
  { key: "assessment", label: "保険AI査定", icon: "🔍" },
  { key: "drone", label: "ドローン判定", icon: "🚁" },
  { key: "pml", label: "PML計算", icon: "📊" },
  { key: "pricing", label: "料金プラン", icon: "💰" },
];

// ── Assessment Tab ────────────────────────────────────────────────────────

function AssessmentTab() {
  const [damageType, setDamageType] = useState<DamageType>("fire");
  const [photoUrls, setPhotoUrls] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [constructionCost, setConstructionCost] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: AssessmentInput = {
      photoUrls: photoUrls
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      damageType,
      estimatedAreaM2: areaM2 ? parseFloat(areaM2) : undefined,
      constructionCostJpy: constructionCost ? parseFloat(constructionCost) : undefined,
    };
    setResult(assessDamage(input));
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">損害情報入力</h2>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">損害種別</label>
          <select
            value={damageType}
            onChange={(e) => setDamageType(e.target.value as DamageType)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(DAMAGE_TYPE_LABELS) as DamageType[]).map((k) => (
              <option key={k} value={k}>
                {DAMAGE_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            被害写真URL (複数可、改行 or カンマ区切り)
          </label>
          <textarea
            value={photoUrls}
            onChange={(e) => setPhotoUrls(e.target.value)}
            rows={3}
            placeholder="https://example.com/damage1.jpg&#10;https://example.com/damage2.jpg"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">被害面積 (m²)</label>
            <input
              type="number"
              value={areaM2}
              onChange={(e) => setAreaM2(e.target.value)}
              placeholder="例: 50"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">構造物原価 (円)</label>
            <input
              type="number"
              value={constructionCost}
              onChange={(e) => setConstructionCost(e.target.value)}
              placeholder="例: 10000000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          査定実行
        </button>
      </form>

      {result !== null && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800">査定結果</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">推定損害額</p>
              <p className="text-lg font-bold text-slate-900">
                ¥{result.estimatedDamageJpy.toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-slate-500">支払見込額</p>
              <p className="text-lg font-bold text-blue-700">
                ¥{result.estimatedPayoutJpy.toLocaleString("ja-JP")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">根拠スコア</span>
            <div className="flex-1 rounded-full bg-slate-200 h-2">
              <div
                className="rounded-full bg-blue-500 h-2 transition-all"
                style={{ width: `${result.confidenceScore * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {Math.round(result.confidenceScore * 100)}%
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              免責適用: {result.deductibleApplied ? "あり" : "なし"}
            </p>
            <p className="text-xs font-semibold text-slate-600 mb-1">適用約款条項</p>
            <ul className="space-y-1">
              {result.applicableClauses.map((c) => (
                <li key={c.id} className="text-xs text-slate-700 bg-slate-50 rounded px-2 py-1">
                  {c.articleNumber} {c.title} — 補償率{(c.coverageRatio * 100).toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">査定根拠</p>
            <ul className="space-y-1">
              {result.assessmentNotes.map((note, i) => (
                <li key={i} className="text-xs text-slate-600">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drone Tab ─────────────────────────────────────────────────────────────

function DroneTab() {
  const [photoCount, setPhotoCount] = useState("5");
  const [altitude, setAltitude] = useState("30");
  const [hasGps, setHasGps] = useState(true);
  const [unitCost, setUnitCost] = useState("50000");
  const [result, setResult] = useState<DroneAssessmentResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(photoCount, 10) || 0;
    const alt = parseFloat(altitude) || 30;
    const photos: DronePhotoMeta[] = Array.from({ length: count }, (_, i) => ({
      url: `https://drone-photos.example.com/shot-${i + 1}.jpg`,
      flightAltitudeM: alt,
      gsdCmPerPixel: alt * 0.025,
      gps: hasGps
        ? { lat: 35.6762 + i * 0.0001, lng: 139.6503 + i * 0.0001, altitudeM: alt }
        : undefined,
    }));
    setResult(assessDroneImages(photos, parseFloat(unitCost) || 50_000));
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">ドローン撮影条件</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">写真枚数</label>
            <input
              type="number"
              value={photoCount}
              onChange={(e) => setPhotoCount(e.target.value)}
              min="1"
              max="100"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">飛行高度 (m)</label>
            <input
              type="number"
              value={altitude}
              onChange={(e) => setAltitude(e.target.value)}
              min="5"
              max="150"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">損害単価 (円/m²)</label>
          <input
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={hasGps}
            onChange={(e) => setHasGps(e.target.checked)}
            className="rounded"
          />
          GPS座標データあり
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          ドローン査定実行
        </button>
      </form>

      {result !== null && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800">ドローン査定結果</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">推定損害額</p>
              <p className="text-lg font-bold text-slate-900">
                ¥{result.estimatedDamageJpy.toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-slate-500">査定信頼度</p>
              <p className="text-lg font-bold text-blue-700">
                {Math.round(result.confidenceScore * 100)}%
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="text-xs font-semibold text-slate-600">3D点群サマリ</p>
            <p className="text-xs text-slate-700">
              推定点群数: {result.pointCloudSummary.estimatedPointCount.toLocaleString("ja-JP")}点
            </p>
            <p className="text-xs text-slate-700">
              撮影面積: {result.pointCloudSummary.estimatedAreaM2.toLocaleString("ja-JP")}m²
            </p>
            <p className="text-xs text-slate-700">
              推定体積: {result.pointCloudSummary.estimatedVolumeM3.toLocaleString("ja-JP")}m³
            </p>
            <p className="text-xs text-slate-700">
              バウンディングボックス: {result.pointCloudSummary.boundingBox.widthM}×
              {result.pointCloudSummary.boundingBox.heightM}×
              {result.pointCloudSummary.boundingBox.depthM} m
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              被害領域 ({result.damageMask.regions.length}箇所 / 被害率{" "}
              {(result.damageMask.overallDamageRatio * 100).toFixed(1)}%)
            </p>
            <div className="space-y-1">
              {result.damageMask.regions.map((r, i) => (
                <div key={i} className="text-xs text-slate-700 bg-slate-50 rounded px-2 py-1 flex justify-between">
                  <span>領域{i + 1}: {Math.floor(r.estimatedAreaM2)}m²</span>
                  <span className="text-slate-500">確信度 {Math.round(r.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">処理ログ</p>
            <ul className="space-y-1">
              {result.processingNotes.map((note, i) => (
                <li key={i} className="text-xs text-slate-600">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PML Tab ───────────────────────────────────────────────────────────────

function PmlTab() {
  const [structureType, setStructureType] = useState<StructureType>("rc");
  const [seismicGrade, setSeismicGrade] = useState<SeismicGrade>("standard_1981");
  const [buildingAge, setBuildingAge] = useState("20");
  const [damageHistory, setDamageHistory] = useState("0");
  const [retrofitCompleted, setRetrofitCompleted] = useState(false);
  const [retrofitYearsAgo, setRetrofitYearsAgo] = useState("5");
  const [result, setResult] = useState<PmlResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: PmlInput = {
      structureType,
      seismicGrade,
      buildingAgeYears: parseInt(buildingAge, 10) || 0,
      damageHistoryCount: parseInt(damageHistory, 10) || 0,
      retrofitCompleted,
      retrofitYearsAgo: retrofitCompleted ? parseInt(retrofitYearsAgo, 10) || 0 : 0,
    };
    setResult(calculatePml(input));
  }

  const riskStyle = result ? (RISK_STYLES[result.riskLevel] ?? RISK_STYLES.medium) : null;

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">建物情報入力</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">構造種別</label>
            <select
              value={structureType}
              onChange={(e) => setStructureType(e.target.value as StructureType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(STRUCTURE_LABELS) as StructureType[]).map((k) => (
                <option key={k} value={k}>
                  {STRUCTURE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">耐震グレード</label>
            <select
              value={seismicGrade}
              onChange={(e) => setSeismicGrade(e.target.value as SeismicGrade)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(SEISMIC_LABELS) as SeismicGrade[]).map((k) => (
                <option key={k} value={k}>
                  {SEISMIC_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">築年数</label>
            <input
              type="number"
              value={buildingAge}
              onChange={(e) => setBuildingAge(e.target.value)}
              min="0"
              max="100"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">損害履歴件数</label>
            <input
              type="number"
              value={damageHistory}
              onChange={(e) => setDamageHistory(e.target.value)}
              min="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={retrofitCompleted}
              onChange={(e) => setRetrofitCompleted(e.target.checked)}
              className="rounded"
            />
            耐震補強済み
          </label>
          {retrofitCompleted && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">補強後経過年数</label>
              <input
                type="number"
                value={retrofitYearsAgo}
                onChange={(e) => setRetrofitYearsAgo(e.target.value)}
                min="0"
                max="50"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          PML計算
        </button>
      </form>

      {result !== null && riskStyle !== null && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-800">PML算出結果</h2>

          <div className={`rounded-xl p-4 ${riskStyle.bg} text-center`}>
            <p className={`text-3xl font-bold ${riskStyle.text}`}>{result.pmlPercent}%</p>
            <p className={`text-sm font-semibold ${riskStyle.text} mt-1`}>{riskStyle.label}</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 space-y-1">
            <p className="text-xs font-semibold text-slate-600">算出内訳</p>
            <p className="text-xs text-slate-700">
              基準率: {(result.breakdown.baseRate * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-700">
              構造係数: ×{result.breakdown.structureFactor}
            </p>
            <p className="text-xs text-slate-700">
              年数係数: ×{result.breakdown.ageMultiplier}
            </p>
            <p className="text-xs text-slate-700">
              補強割引: -{(result.breakdown.retrofitDiscount * 100).toFixed(0)}%
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">算出根拠</p>
            <ul className="space-y-1">
              {result.notes.map((note, i) => (
                <li key={i} className="text-xs text-slate-600">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pricing Tab ───────────────────────────────────────────────────────────

function PricingTab() {
  const [segment, setSegment] = useState<TargetSegment>("general_contractor");
  const [projectVolume, setProjectVolume] = useState("10");
  const [recommendation, setRecommendation] = useState<ReturnType<typeof getRecommendedPlan> | null>(null);

  const allPlans = getAllPlans();

  function handleRecommend(e: React.FormEvent) {
    e.preventDefault();
    setRecommendation(getRecommendedPlan(segment, parseInt(projectVolume, 10) || 0));
  }

  function PlanCard({ plan, highlighted = false }: { plan: InsurancePlan; highlighted?: boolean }) {
    return (
      <div
        className={`rounded-xl border-2 bg-white p-4 shadow-sm ${
          highlighted ? "border-blue-400" : PLAN_STYLES[plan.tier]
        }`}
      >
        {highlighted && (
          <div className="mb-2 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
            推奨
          </div>
        )}
        <p className="text-sm font-bold text-slate-800">{plan.name}</p>
        <p className="text-xl font-bold text-blue-600 mt-1">{formatPlanPrice(plan)}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          年払い ¥{Math.floor(plan.annualPriceJpy).toLocaleString("ja-JP")}/年
        </p>
        <ul className="mt-3 space-y-1">
          {plan.features.map((f, i) => (
            <li key={i} className={`text-xs flex items-center gap-1.5 ${f.included ? "text-slate-700" : "text-slate-400"}`}>
              <span>{f.included ? "✓" : "—"}</span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleRecommend} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">プラン診断</h2>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">セグメント</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as TargetSegment)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(SEGMENT_LABELS) as TargetSegment[]).map((k) => (
              <option key={k} value={k}>
                {SEGMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">月間案件数</label>
          <input
            type="number"
            value={projectVolume}
            onChange={(e) => setProjectVolume(e.target.value)}
            min="1"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          推奨プランを診断
        </button>
      </form>

      {recommendation !== null && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">診断結果</p>
          <p className="text-xs">{recommendation.reason}</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700">全プラン比較</h2>
        {allPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            highlighted={recommendation?.plan.tier === plan.tier}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function InsuranceAssessmentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("assessment");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">工事保険AI査定</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          損害保険協会工事約款 + IRDR国際基準に基づく自動査定システム
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "assessment" && <AssessmentTab />}
      {activeTab === "drone" && <DroneTab />}
      {activeTab === "pml" && <PmlTab />}
      {activeTab === "pricing" && <PricingTab />}
    </div>
  );
}
