/**
 * OwnerAmbassadorPage — 施主アンバサダー化ダッシュボード (Sprint 18-C)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  OwnerAmbassador,
  ReferralLink,
  ReferralInquiry,
  ReferralReward,
  AmbassadorTier,
  ReferralChannel,
  ReferralStatus,
} from "../lib/owner-ambassador/types.js";
import {
  AMBASSADOR_TIER_LABELS,
  REFERRAL_STATUS_LABELS,
  REWARD_KIND_LABELS,
  REFERRAL_CHANNEL_LABELS,
  makeOwnerAmbassadorId,
  makeReferralLinkId,
} from "../lib/owner-ambassador/types.js";
import { ambassadorStore } from "../lib/owner-ambassador/ambassador-store.js";
import {
  createAmbassador,
  issueReferralLink,
  recordReferralInquiry,
  updateInquiryStatus,
  finalizeReferralReward,
  listAmbassadors,
  getLinksForAmbassador,
  listAllLinks,
  listAllInquiries,
  listAllRewards,
} from "../lib/owner-ambassador/ambassador-facade.js";
import {
  totalActiveAmbassadors,
  pendingReferralInquiries,
  monthlyRewardPayoutJpy,
  mostProductiveAmbassadorName,
} from "../lib/owner-ambassador/portfolio-ambassador-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const TIER_COLORS: Record<AmbassadorTier, string> = {
  bronze: "#cd7f32",
  silver: "#9ca3af",
  gold: "#f59e0b",
  platinum: "#8b5cf6",
};

const CHANNEL_OPTIONS: ReferralChannel[] = ["line", "email", "sns", "qr_code", "direct_link"];

const STATUS_COLOR: Record<ReferralStatus, string> = {
  pending: "#d97706",
  contacted: "#3b82f6",
  quoted: "#8b5cf6",
  contracted: SAGE,
  completed: "#059669",
  expired: "#9ca3af",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: SAGE }}>{value}</div>
    </div>
  );
}

function TierBadge({ tier }: { tier: AmbassadorTier }) {
  return (
    <span
      style={{
        fontSize: 11,
        background: TIER_COLORS[tier] + "22",
        color: TIER_COLORS[tier],
        borderRadius: 4,
        padding: "2px 8px",
        fontWeight: 700,
      }}
    >
      {AMBASSADOR_TIER_LABELS[tier]}
    </span>
  );
}

function StatusBadge({ status }: { status: ReferralStatus }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: STATUS_COLOR[status],
        borderRadius: 4,
        padding: "2px 6px",
        border: `1px solid ${STATUS_COLOR[status]}44`,
        background: STATUS_COLOR[status] + "11",
      }}
    >
      {REFERRAL_STATUS_LABELS[status]}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function OwnerAmbassadorPage() {
  const [ambassadors, setAmbassadors] = useState<OwnerAmbassador[]>([]);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [inquiries, setInquiries] = useState<ReferralInquiry[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);

  // Form state
  const [newAmbName, setNewAmbName] = useState("");
  const [newAmbProject, setNewAmbProject] = useState("");
  const [selectedAmbId, setSelectedAmbId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<ReferralChannel>("line");
  const [linkExpiryDays, setLinkExpiryDays] = useState(90);
  const [inqLinkId, setInqLinkId] = useState("");
  const [inqName, setInqName] = useState("");
  const [inqDesc, setInqDesc] = useState("");

  const refresh = useCallback(() => {
    setAmbassadors(listAmbassadors());
    setLinks(listAllLinks());
    setInquiries(listAllInquiries());
    setRewards(listAllRewards());
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = ambassadorStore.subscribe(() => refresh());
    return unsubscribe;
  }, [refresh]);

  // KPI
  const kpiTotal = totalActiveAmbassadors();
  const kpiPending = pendingReferralInquiries();
  const kpiPayout = monthlyRewardPayoutJpy();
  const kpiTop = mostProductiveAmbassadorName();

  // Handlers
  const handleCreateAmbassador = () => {
    if (!newAmbName.trim() || !newAmbProject.trim()) return;
    createAmbassador(newAmbName.trim(), newAmbProject.trim());
    setNewAmbName("");
    setNewAmbProject("");
    refresh();
  };

  const handleIssueLink = () => {
    if (!selectedAmbId) return;
    issueReferralLink(makeOwnerAmbassadorId(selectedAmbId), selectedChannel, linkExpiryDays);
    refresh();
  };

  const handleRecordInquiry = () => {
    if (!inqLinkId || !inqName.trim()) return;
    recordReferralInquiry(makeReferralLinkId(inqLinkId), inqName.trim(), inqDesc.trim());
    setInqName("");
    setInqDesc("");
    refresh();
  };

  const handleAdvanceStatus = (inq: ReferralInquiry) => {
    const ORDER: ReferralStatus[] = ["pending", "contacted", "quoted", "contracted", "completed"];
    const idx = ORDER.indexOf(inq.status);
    if (idx < 0 || idx >= ORDER.length - 1) return;
    const next = ORDER[idx + 1];
    const amount = next === "contracted" ? 5_000_000 : undefined; // demo value
    updateInquiryStatus(inq.id, next, amount);
    refresh();
  };

  const handleFinalizeReward = (inq: ReferralInquiry) => {
    finalizeReferralReward(inq.id, "cash");
    refresh();
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        施主アンバサダー管理
      </h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        完工後の施主をアンバサダーに登録し、紹介報酬で新案件を獲得します。
      </p>

      {/* KPI行 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <KpiCard label="アクティブアンバサダー" value={kpiTotal} />
        <KpiCard label="未処理問合せ" value={kpiPending} />
        <KpiCard label="今月報酬支払予定 (JPY)" value={`¥${kpiPayout.toLocaleString("ja-JP")}`} />
        <KpiCard label="最多紹介者" value={kpiTop ?? "—"} />
      </div>

      {/* アンバサダー登録フォーム */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>アンバサダー登録</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="施主名"
            value={newAmbName}
            onChange={(e) => setNewAmbName(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14, width: 160 }}
          />
          <input
            type="text"
            placeholder="完工プロジェクトID"
            value={newAmbProject}
            onChange={(e) => setNewAmbProject(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14, width: 200 }}
          />
          <button
            onClick={handleCreateAmbassador}
            style={{ background: SAGE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 14, cursor: "pointer" }}
          >
            登録
          </button>
        </div>
      </section>

      {/* アンバサダー一覧テーブル */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>アンバサダー一覧</h3>
        {ambassadors.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>アンバサダーが登録されていません</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["施主名", "プロジェクト", "ティア", "成約件数", "総成約額", "総報酬額"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ambassadors.map((amb) => (
                <tr key={amb.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px" }}>{amb.ownerName}</td>
                  <td style={{ padding: "8px 12px", color: "#6b7280" }}>{amb.completedProjectId}</td>
                  <td style={{ padding: "8px 12px" }}><TierBadge tier={amb.tier} /></td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{amb.contractedReferralCount}</td>
                  <td style={{ padding: "8px 12px" }}>¥{amb.totalContractedAmountJpy.toLocaleString("ja-JP")}</td>
                  <td style={{ padding: "8px 12px", color: SAGE, fontWeight: 600 }}>¥{amb.totalRewardAmountJpy.toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 紹介リンク発行フォーム */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>紹介リンク発行</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={selectedAmbId}
            onChange={(e) => setSelectedAmbId(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14 }}
          >
            <option value="">アンバサダーを選択</option>
            {ambassadors.map((a) => (
              <option key={a.id} value={a.id}>{a.ownerName}</option>
            ))}
          </select>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as ReferralChannel)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14 }}
          >
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>{REFERRAL_CHANNEL_LABELS[ch]}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={365}
            value={linkExpiryDays}
            onChange={(e) => setLinkExpiryDays(Number(e.target.value))}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14, width: 80 }}
          />
          <span style={{ lineHeight: "32px", fontSize: 13, color: "#6b7280" }}>日間</span>
          <button
            onClick={handleIssueLink}
            style={{ background: SAGE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 14, cursor: "pointer" }}
          >
            発行
          </button>
        </div>
      </section>

      {/* アクティブ紹介リンク一覧 */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>アクティブ紹介リンク</h3>
        {links.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>紹介リンクがありません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {links.filter((l) => l.isActive).map((link) => {
              const amb = ambassadors.find((a) => a.id === link.ambassadorId);
              return (
                <div key={link.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", background: "#fff", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: SAGE, fontWeight: 600 }}>{amb?.ownerName ?? "—"}</span>
                  <span style={{ fontSize: 12, background: "#f0f4ee", color: SAGE, borderRadius: 4, padding: "2px 8px" }}>
                    {REFERRAL_CHANNEL_LABELS[link.channel]}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {link.url}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    期限: {new Date(link.expiresAt).toLocaleDateString("ja-JP")}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>クリック: {link.clickCount}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 問合せ記録フォーム */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>紹介問合せ記録</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={inqLinkId}
            onChange={(e) => setInqLinkId(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14 }}
          >
            <option value="">リンクを選択</option>
            {links.map((l) => {
              const amb = ambassadors.find((a) => a.id === l.ambassadorId);
              return (
                <option key={l.id} value={l.id}>
                  {amb?.ownerName ?? "—"} / {REFERRAL_CHANNEL_LABELS[l.channel]}
                </option>
              );
            })}
          </select>
          <input
            type="text"
            placeholder="問合せ者名"
            value={inqName}
            onChange={(e) => setInqName(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14, width: 160 }}
          />
          <input
            type="text"
            placeholder="内容メモ"
            value={inqDesc}
            onChange={(e) => setInqDesc(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 14, width: 200 }}
          />
          <button
            onClick={handleRecordInquiry}
            style={{ background: SAGE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 14, cursor: "pointer" }}
          >
            記録
          </button>
        </div>
      </section>

      {/* 紹介問合せステータスボード */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>紹介問合せステータスボード</h3>
        {inquiries.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>問合せがありません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inquiries.map((inq) => {
              const amb = ambassadors.find((a) => a.id === inq.ambassadorId);
              const canFinalize = inq.status === "contracted" || inq.status === "completed";
              const canAdvance = inq.status !== "completed" && inq.status !== "expired";
              return (
                <div key={inq.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <StatusBadge status={inq.status} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{inq.inquirerName}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>紹介者: {amb?.ownerName ?? "—"}</span>
                    {inq.contractAmountJpy && (
                      <span style={{ fontSize: 12, color: SAGE, fontWeight: 600 }}>
                        ¥{inq.contractAmountJpy.toLocaleString("ja-JP")}
                      </span>
                    )}
                  </div>
                  {inq.description && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{inq.description}</div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    {canAdvance && (
                      <button
                        onClick={() => handleAdvanceStatus(inq)}
                        style={{ fontSize: 12, background: "#f0f4ee", color: SAGE, border: `1px solid ${SAGE}44`, borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
                      >
                        次のステータスへ
                      </button>
                    )}
                    {canFinalize && (
                      <button
                        onClick={() => handleFinalizeReward(inq)}
                        style={{ fontSize: 12, background: SAGE, color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
                      >
                        報酬確定
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 報酬支払い予定リスト */}
      <section>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>報酬支払い予定</h3>
        {rewards.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>報酬確定済み案件がありません</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["アンバサダー", "報酬種別", "金額", "報酬率", "支払状況", "税務メモ"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => {
                const amb = ambassadors.find((a) => a.id === r.ambassadorId);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px" }}>{amb?.ownerName ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{REWARD_KIND_LABELS[r.kind]}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: SAGE }}>¥{r.amountJpy.toLocaleString("ja-JP")}</td>
                    <td style={{ padding: "8px 12px" }}>{(r.rewardRate * 100).toFixed(0)}%</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: r.isPaid ? "#059669" : DANGER, fontSize: 12 }}>
                        {r.isPaid ? "支払済" : "未払い"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280", maxWidth: 300 }}>{r.taxNoteJa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
