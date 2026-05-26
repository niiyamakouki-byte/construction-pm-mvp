/**
 * OwnerSuggestionPage — 施主提案AI ダッシュボード (Sprint 18-A)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type { OwnerSuggestion, SuggestionPlan, LifestyleTag, PriorityRanking } from "../lib/owner-suggestion/types.js";
import {
  LIFESTYLE_TAG_LABELS,
  PRIORITY_RANKING_LABELS,
  PLAN_KIND_LABELS,
  PLAN_STATUS_LABELS,
} from "../lib/owner-suggestion/types.js";
import { ownerSuggestionStore } from "../lib/owner-suggestion/owner-suggestion-store.js";
import {
  createSuggestion,
  presentToOwner,
  markPlanDecision,
  exportPDF,
  listAllSuggestions,
} from "../lib/owner-suggestion/owner-suggestion-facade.js";
import {
  pendingOwnerSuggestions,
  acceptedSuggestionRate,
  mostPopularPlanKind,
  avgBudgetGap,
} from "../lib/owner-suggestion/portfolio-owner-suggestion-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const LIFESTYLE_OPTIONS: LifestyleTag[] = [
  "cooking",
  "work_from_home",
  "entertain_guests",
  "pet_owner",
  "elderly_care",
];

const PRIORITY_OPTIONS: PriorityRanking[] = [
  "priceFirst",
  "qualityFirst",
  "designFirst",
  "durabilityFirst",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatJpy(amount: number): string {
  return `${(amount / 10000).toFixed(0)}万円`;
}

function planStatusColor(status: SuggestionPlan["status"]): string {
  if (status === "accepted") return SAGE;
  if (status === "rejected") return DANGER;
  if (status === "in_review") return "#d97706";
  if (status === "presented") return "#2563eb";
  return "#94a3b8";
}

function budgetGapLabel(gap: number): string {
  if (gap > 0) return `予算+${formatJpy(gap)}`;
  if (gap < 0) return `予算-${formatJpy(Math.abs(gap))}`;
  return "予算通り";
}

// ── Metric card ────────────────────────────────────────────────────────────

type MetricCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
};

function MetricCard({ label, value, sub, accent }: MetricCardProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "12px 16px",
        borderTop: `3px solid ${accent ? DANGER : SAGE}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? DANGER : "#1e293b" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Plan card ──────────────────────────────────────────────────────────────

type PlanCardProps = {
  plan: SuggestionPlan;
  profile: OwnerSuggestion["ownerProfile"];
  onAccept: () => void;
  onReject: () => void;
  decided: boolean;
};

function PlanCard({ plan, profile, onAccept, onReject, decided }: PlanCardProps) {
  const gap = plan.estimatedCost - profile.budget;
  const isAccepted = plan.status === "accepted";
  const isRejected = plan.status === "rejected";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: 20,
        borderTop: `4px solid ${isAccepted ? SAGE : isRejected ? "#e2e8f0" : SAGE}`,
        boxShadow: isAccepted
          ? `0 0 0 2px ${SAGE}40, 0 2px 8px rgba(0,0,0,0.08)`
          : "0 1px 4px rgba(0,0,0,0.06)",
        opacity: isRejected ? 0.6 : 1,
        flex: 1,
        minWidth: 220,
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{plan.titleJa}</div>
          <div style={{ fontSize: 12, color: SAGE }}>{PLAN_KIND_LABELS[plan.kind]}</div>
        </div>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 99,
            background: `${planStatusColor(plan.status)}18`,
            color: planStatusColor(plan.status),
            fontWeight: 600,
          }}
        >
          {PLAN_STATUS_LABELS[plan.status]}
        </span>
      </div>

      {/* Cost / Days */}
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>概算費用</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{formatJpy(plan.estimatedCost)}</div>
          <div style={{ fontSize: 10, color: gap > 0 ? DANGER : SAGE }}>{budgetGapLabel(gap)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>工期</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{plan.estimatedDays}日</div>
        </div>
      </div>

      {/* Concept */}
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{plan.conceptJa}</div>

      {/* Material highlights */}
      <div>
        <div style={{ fontSize: 11, color: SAGE, fontWeight: 600, marginBottom: 4 }}>材料ハイライト</div>
        {plan.materialHighlights.slice(0, 3).map((mh, i) => (
          <div key={i} style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>
            <span style={{ color: "#94a3b8" }}>{mh.location}：</span>{mh.materialName}
          </div>
        ))}
      </div>

      {/* Risk notes */}
      {plan.riskNotes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: DANGER, fontWeight: 600, marginBottom: 2 }}>リスク</div>
          {plan.riskNotes.map((note, i) => (
            <div key={i} style={{ fontSize: 11, color: "#64748b" }}>・{note}</div>
          ))}
        </div>
      )}

      {/* Decision buttons */}
      {!decided && (
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8 }}>
          <button
            onClick={onAccept}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${SAGE}`,
              background: SAGE, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            採用する
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid #e2e8f0",
              background: "#f8fafc", color: "#64748b", fontSize: 12, cursor: "pointer",
            }}
          >
            見送り
          </button>
        </div>
      )}
    </div>
  );
}

// ── Profile form ───────────────────────────────────────────────────────────

type ProfileFormProps = {
  onGenerate: (profile: OwnerSuggestion["ownerProfile"], budget: number) => void;
  loading: boolean;
};

function ProfileForm({ onGenerate, loading }: ProfileFormProps) {
  const [ownerName, setOwnerName] = useState("");
  const [budget, setBudget] = useState(8000000);
  const [familySize, setFamilySize] = useState(2);
  const [ageRange, setAgeRange] = useState("40s");
  const [lifestyle, setLifestyle] = useState<LifestyleTag[]>([]);
  const [priorityRanking, setPriorityRanking] = useState<PriorityRanking>("qualityFirst");

  const toggleLifestyle = (tag: LifestyleTag) => {
    setLifestyle((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim()) return;
    onGenerate(
      { ownerName: ownerName.trim(), budget, familySize, ageRange, lifestyle, priorityRanking },
      budget,
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>施主名 *</label>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="例: 田中 太郎"
            required
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
              fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>予算 (万円)</label>
          <input
            type="number"
            value={budget / 10000}
            onChange={(e) => setBudget(Number(e.target.value) * 10000)}
            min={100}
            max={10000}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
              fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>家族人数</label>
          <input
            type="number"
            value={familySize}
            onChange={(e) => setFamilySize(Number(e.target.value))}
            min={1}
            max={10}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
              fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>年齢帯</label>
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
              fontSize: 13, boxSizing: "border-box", background: "#fff",
            }}
          >
            {["20s", "30s", "40s", "50s", "60s+"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lifestyle tags */}
      <div>
        <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>ライフスタイル</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {LIFESTYLE_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleLifestyle(tag)}
              style={{
                padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                border: `1px solid ${lifestyle.includes(tag) ? SAGE : "#e2e8f0"}`,
                background: lifestyle.includes(tag) ? `${SAGE}18` : "#fff",
                color: lifestyle.includes(tag) ? SAGE : "#64748b",
                fontWeight: lifestyle.includes(tag) ? 600 : 400,
              }}
            >
              {LIFESTYLE_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 6 }}>優先軸</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityRanking(p)}
              style={{
                padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                border: `1px solid ${priorityRanking === p ? SAGE : "#e2e8f0"}`,
                background: priorityRanking === p ? `${SAGE}18` : "#fff",
                color: priorityRanking === p ? SAGE : "#64748b",
                fontWeight: priorityRanking === p ? 600 : 400,
              }}
            >
              {PRIORITY_RANKING_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !ownerName.trim()}
        style={{
          padding: "10px 24px", borderRadius: 8, border: "none",
          background: loading ? "#94a3b8" : SAGE, color: "#fff",
          fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {loading ? "生成中..." : "3案を生成する"}
      </button>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function OwnerSuggestionPage() {
  const [suggestions, setSuggestions] = useState<OwnerSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [projectId] = useState("proj-demo");
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(() => {
    setSuggestions(listAllSuggestions(50));
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = ownerSuggestionStore.subscribe(() => refresh());
    return unsubscribe;
  }, [refresh]);

  const selected = selectedId ? suggestions.find((s) => s.id === selectedId) ?? null : null;

  const handleGenerate = useCallback(
    (profile: OwnerSuggestion["ownerProfile"], budget: number) => {
      setGenerating(true);
      try {
        const s = createSuggestion(projectId, profile, budget);
        setSelectedId(s.id);
        setShowForm(false);
      } finally {
        setGenerating(false);
      }
    },
    [projectId],
  );

  const handlePresent = useCallback(
    (id: string) => {
      presentToOwner(id);
    },
    [],
  );

  const handleDecision = useCallback(
    (suggestionId: string, planId: string, accepted: boolean) => {
      markPlanDecision(suggestionId, planId, accepted);
    },
    [],
  );

  const handleExportPDF = useCallback(
    (id: string, format: "markdown" | "html" | "pdf_data") => {
      const result = exportPDF(id, format);
      if (result) setPdfPreview(result);
    },
    [],
  );

  // KPIs
  const pending = pendingOwnerSuggestions();
  const rate = acceptedSuggestionRate();
  const popularKind = mostPopularPlanKind();
  const gap = avgBudgetGap();

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>施主提案AI</h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            施主プロフィールから最適な内装プラン3案を自動生成
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: SAGE, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {showForm ? "閉じる" : "新規提案作成"}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <MetricCard label="未決定提案" value={pending} sub="draft/presented" accent={pending > 0} />
        <MetricCard label="採用率" value={`${Math.round(rate * 100)}%`} sub="accepted/(accepted+rejected)" />
        <MetricCard
          label="最人気プラン"
          value={popularKind ? PLAN_KIND_LABELS[popularKind] : "—"}
          sub="採用実績より"
        />
        <MetricCard
          label="平均予算差分"
          value={gap === 0 ? "—" : budgetGapLabel(gap)}
          sub="採用プランvs予算"
          accent={gap > 500000}
        />
      </div>

      {/* Form */}
      {showForm && (
        <div
          style={{
            background: "#fff", borderRadius: 10, padding: 24, marginBottom: 24,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderTop: `3px solid ${SAGE}`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 16 }}>
            施主プロフィール入力
          </div>
          <ProfileForm onGenerate={handleGenerate} loading={generating} />
        </div>
      )}

      {/* Suggestion list + detail */}
      <div style={{ display: "flex", gap: 20 }}>
        {/* List */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
            提案一覧 ({suggestions.length}件)
          </div>
          {suggestions.length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 12, padding: "12px 0" }}>
              提案がありません。「新規提案作成」から始めてください。
            </div>
          )}
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 6,
                background: selectedId === s.id ? `${SAGE}14` : "#fff",
                border: `1px solid ${selectedId === s.id ? SAGE : "#e2e8f0"}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                {s.ownerProfile.ownerName} 様
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {formatJpy(s.ownerProfile.budget)} / {s.ownerProfile.familySize}名
              </div>
              <div style={{ fontSize: 11, color: s.decidedPlanId ? SAGE : "#d97706", marginTop: 2 }}>
                {s.decidedPlanId ? "決定済み" : s.presentedAt ? "提示済み" : "下書き"}
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div style={{ flex: 1 }}>
            {/* Owner info */}
            <div
              style={{
                background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                    {selected.ownerProfile.ownerName} 様
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    予算 {formatJpy(selected.ownerProfile.budget)} / {selected.ownerProfile.familySize}名 / {selected.ownerProfile.ageRange}
                    {" / "}
                    {selected.ownerProfile.lifestyle.map((t) => LIFESTYLE_TAG_LABELS[t]).join("・") || "タグなし"}
                    {" / "}
                    {PRIORITY_RANKING_LABELS[selected.ownerProfile.priorityRanking]}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!selected.presentedAt && (
                    <button
                      onClick={() => handlePresent(selected.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 6, border: `1px solid ${SAGE}`,
                        background: "#fff", color: SAGE, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      施主に提示
                    </button>
                  )}
                  <button
                    onClick={() => handleExportPDF(selected.id, "html")}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
                      background: "#f8fafc", color: "#475569", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    PDFプレビュー
                  </button>
                </div>
              </div>
            </div>

            {/* 3 plan cards */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              {selected.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  profile={selected.ownerProfile}
                  decided={!!selected.decidedPlanId}
                  onAccept={() => handleDecision(selected.id, plan.id, true)}
                  onReject={() => handleDecision(selected.id, plan.id, false)}
                />
              ))}
            </div>

            {/* Decision result */}
            {selected.decidedPlanId && (
              <div
                style={{
                  background: `${SAGE}12`, border: `1px solid ${SAGE}`, borderRadius: 8,
                  padding: "12px 16px", fontSize: 13, color: SAGE, fontWeight: 600,
                }}
              >
                採用決定：{selected.plans.find((p) => p.id === selected.decidedPlanId)?.titleJa}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF preview modal */}
      {pdfPreview && (
        <div
          onClick={() => setPdfPreview(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 10, padding: 0, width: "85vw", maxWidth: 900,
              maxHeight: "85vh", overflow: "auto", position: "relative",
            }}
          >
            <div
              style={{
                position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e2e8f0",
                padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>PDFプレビュー</span>
              <div style={{ display: "flex", gap: 8 }}>
                {(["markdown", "html", "pdf_data"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => selectedId && handleExportPDF(selectedId, fmt)}
                    style={{
                      padding: "4px 10px", borderRadius: 4, border: "1px solid #e2e8f0",
                      background: "#f8fafc", fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {fmt}
                  </button>
                ))}
                <button
                  onClick={() => setPdfPreview(null)}
                  style={{
                    padding: "4px 10px", borderRadius: 4, border: "none",
                    background: "#1e293b", color: "#fff", fontSize: 11, cursor: "pointer",
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>
            {pdfPreview.startsWith("<!DOCTYPE") ? (
              <iframe
                srcDoc={pdfPreview}
                style={{ width: "100%", height: "70vh", border: "none" }}
                title="PDF Preview"
              />
            ) : (
              <pre
                style={{
                  padding: 24, margin: 0, fontSize: 12, lineHeight: 1.7,
                  whiteSpace: "pre-wrap", color: "#1e293b",
                }}
              >
                {pdfPreview}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
