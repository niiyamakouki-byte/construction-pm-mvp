/**
 * LocalSeoPage — 地域SEOダッシュボード (Sprint 19-B)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  SeoArticle,
  KeywordTarget,
  SerpSnapshot,
  RegionScope,
  ArticleStatus,
  SerpRankBucket,
} from "../lib/local-seo/types.js";
import {
  regionScopeLabelJa,
  articleStatusLabelJa,
  keywordIntentLabelJa,
  serpRankBucketLabelJa,
} from "../lib/local-seo/types.js";
import { localSeoStore } from "../lib/local-seo/local-seo-store.js";
import {
  registerCompletion,
  generateAndSaveArticle,
  publishToHp,
  trackSerp,
  reportToGbp,
  listArticles,
  listKeywords,
  listSnapshots,
  getStrategy,
} from "../lib/local-seo/local-seo-facade.js";
import {
  publishedArticleCount,
  top10KeywordCount,
  estimatedMonthlySearchImpressions,
  gbpActionCount,
} from "../lib/local-seo/portfolio-local-seo-metrics.js";
import type { CompletionProjectMeta } from "../lib/local-seo/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const BUCKET_COLORS: Record<SerpRankBucket, string> = {
  top3: SAGE,
  top10: "#3b82f6",
  top30: "#f59e0b",
  beyond: "#9ca3af",
};

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: "#9ca3af",
  scheduled: "#3b82f6",
  published: SAGE,
  archived: "#6b7280",
};

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit = "",
  color = SAGE,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Article row ────────────────────────────────────────────────────────────

function ArticleRow({
  article,
  onPublish,
}: {
  article: SeoArticle;
  onPublish: (id: SeoArticle["id"]) => void;
}) {
  const color = STATUS_COLORS[article.status];
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px", fontSize: 13, maxWidth: 280 }}>
        <div style={{ fontWeight: 600, color: "#1f2937", marginBottom: 2 }}>{article.title}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>{article.primaryKeyword}</div>
      </td>
      <td style={{ padding: "8px 12px", fontSize: 12 }}>
        {regionScopeLabelJa[article.region]}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            background: `${color}22`,
            color,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
          }}
        >
          {articleStatusLabelJa[article.status]}
        </span>
      </td>
      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
        {article.publishedAt ? article.publishedAt.slice(0, 10) : "—"}
      </td>
      <td style={{ padding: "8px 12px" }}>
        {article.status === "draft" || article.status === "scheduled" ? (
          <button
            onClick={() => onPublish(article.id)}
            style={{
              background: SAGE,
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            公開
          </button>
        ) : article.publishedUrl ? (
          <a
            href={article.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#3b82f6" }}
          >
            リンク
          </a>
        ) : null}
      </td>
    </tr>
  );
}

// ── Keyword row ────────────────────────────────────────────────────────────

function KeywordRow({ kw }: { kw: KeywordTarget }) {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>#{kw.priority}</td>
      <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>{kw.keyword}</td>
      <td style={{ padding: "8px 12px", fontSize: 12 }}>{regionScopeLabelJa[kw.region]}</td>
      <td style={{ padding: "8px 12px", fontSize: 12 }}>{keywordIntentLabelJa[kw.intent]}</td>
      <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>
        {kw.monthlySearchVolume.toLocaleString()}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>
        {kw.competitionScore}
      </td>
    </tr>
  );
}

// ── Snapshot row ───────────────────────────────────────────────────────────

function SnapshotRow({ snap }: { snap: SerpSnapshot }) {
  const color = BUCKET_COLORS[snap.bucket];
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{snap.keyword}</td>
      <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontWeight: 700, color }}>
        {snap.rank}位
      </td>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            background: `${color}22`,
            color,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {serpRankBucketLabelJa[snap.bucket]}
        </span>
      </td>
      <td style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }}>
        {snap.snapshotAt.slice(0, 10)}
      </td>
    </tr>
  );
}

// ── Registration form ──────────────────────────────────────────────────────

const REGION_OPTIONS: RegionScope[] = [
  "city_setagaya",
  "city_shibuya",
  "city_minato",
  "city_yokohama",
  "city_kawasaki",
];

function RegisterForm({ onRegistered }: { onRegistered: (projectId: string) => void }) {
  const [projectId, setProjectId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [workPart, setWorkPart] = useState("内装リノベーション");
  const [areaSqm, setAreaSqm] = useState(75);
  const [durationDays, setDurationDays] = useState(45);
  const [region, setRegion] = useState<RegionScope>("city_setagaya");
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!projectId || !siteName) return;
      setSubmitting(true);

      const meta: CompletionProjectMeta = {
        siteName,
        workPart,
        areaSqm,
        durationDays,
        beforePhotoCount: 8,
        afterPhotoCount: 7,
        completedAt: new Date(completedAt).toISOString(),
      };

      const { top5 } = registerCompletion(projectId, meta, region, "local_purchase");
      const primaryKw = top5[0]?.keyword ?? `${regionScopeLabelJa[region]} マンション リフォーム`;
      const secondaryKws = top5.slice(1, 4).map((k) => k.keyword);
      const article = generateAndSaveArticle(projectId, primaryKw, secondaryKws);
      if (article) {
        publishToHp(article.id);
        trackSerp(projectId, 30);
        reportToGbp(projectId);
      }

      setProjectId("");
      setSiteName("");
      setSubmitting(false);
      onRegistered(projectId);
    },
    [projectId, siteName, workPart, areaSqm, durationDays, region, completedAt, onRegistered],
  );

  const inputStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
  };

  const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, minWidth: 120 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280" };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "16px",
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
        完工案件を登録してSEO記事を自動生成
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>案件ID</span>
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="proj-001" style={inputStyle} />
        </div>
        <div style={{ ...fieldStyle, minWidth: 180 }}>
          <span style={labelStyle}>現場名</span>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="世田谷区松原3丁目マンション" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>部位</span>
          <input value={workPart} onChange={(e) => setWorkPart(e.target.value)} placeholder="内装リノベーション" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>面積 (㎡)</span>
          <input type="number" value={areaSqm} onChange={(e) => setAreaSqm(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>工期 (日)</span>
          <input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>地域</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionScope)}
            style={{ ...inputStyle, width: 120 }}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>{regionScopeLabelJa[r]}</option>
            ))}
          </select>
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>完工日</span>
          <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} style={inputStyle} />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: SAGE,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "7px 16px",
            fontSize: 13,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
            alignSelf: "flex-end",
          }}
        >
          登録 & 自動生成
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function LocalSeoPage() {
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [keywords, setKeywords] = useState<KeywordTarget[]>([]);
  const [snapshots, setSnapshots] = useState<SerpSnapshot[]>([]);
  const [kpis, setKpis] = useState({
    published: 0,
    top10Kw: 0,
    impressions: 0,
    gbpActions: 0,
  });
  const [tab, setTab] = useState<"articles" | "keywords" | "serp" | "gbp">("articles");
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setArticles(listArticles());
    setKeywords(listKeywords(50));
    setSnapshots(listSnapshots(100));
    setKpis({
      published: publishedArticleCount(),
      top10Kw: top10KeywordCount(),
      impressions: estimatedMonthlySearchImpressions(),
      gbpActions: gbpActionCount(),
    });
  }, []);

  useEffect(() => {
    refresh();
    return localSeoStore.subscribe(refresh);
  }, [refresh]);

  const handlePublish = useCallback((id: SeoArticle["id"]) => {
    publishToHp(id);
    refresh();
  }, [refresh]);

  const handleRegistered = useCallback((projectId: string) => {
    setLastProjectId(projectId);
    refresh();
  }, [refresh]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? SAGE : "#6b7280",
    borderBottom: active ? `2px solid ${SAGE}` : "2px solid transparent",
    cursor: "pointer",
    background: "none",
    border: "none",
  });

  const strategy = lastProjectId ? getStrategy(lastProjectId) : null;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          地域SEO自動化
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
          完工案件 → SEO記事自動生成 → laporta-hp 公開 → Google Business Profile 連携 → 地域検索1位へ
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard label="公開記事数" value={kpis.published} unit="件" />
        <KpiCard label="TOP10獲得KW" value={kpis.top10Kw} unit="件" color="#3b82f6" />
        <KpiCard
          label="月間流入推定"
          value={kpis.impressions.toLocaleString()}
          unit="PV"
          color={kpis.impressions > 100 ? SAGE : "#9ca3af"}
        />
        <KpiCard label="GBPアクション" value={kpis.gbpActions} unit="件" color="#8b5cf6" />
      </div>

      {/* Register form */}
      <RegisterForm onRegistered={handleRegistered} />

      {/* Last strategy summary */}
      {strategy && (
        <div
          style={{
            background: `${SAGE}11`,
            border: `1px solid ${SAGE}44`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 600, color: SAGE }}>最新登録</span>
          <span style={{ marginLeft: 8, color: "#374151" }}>
            {strategy.projectMeta.siteName} — {regionScopeLabelJa[strategy.region]} / 推奨KW: {strategy.recommendedKeywords[0]?.keyword}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        <button style={tabStyle(tab === "articles")} onClick={() => setTab("articles")}>
          SEO記事
          {kpis.published > 0 && (
            <span
              style={{
                background: SAGE,
                color: "#fff",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
                marginLeft: 6,
              }}
            >
              {kpis.published}
            </span>
          )}
        </button>
        <button style={tabStyle(tab === "keywords")} onClick={() => setTab("keywords")}>
          キーワード一覧
        </button>
        <button style={tabStyle(tab === "serp")} onClick={() => setTab("serp")}>
          SERP 順位追跡
          {kpis.top10Kw > 0 && (
            <span
              style={{
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
                marginLeft: 6,
              }}
            >
              TOP10: {kpis.top10Kw}
            </span>
          )}
        </button>
        <button style={tabStyle(tab === "gbp")} onClick={() => setTab("gbp")}>
          GBP 投稿スケジュール
        </button>
      </div>

      {/* Tab content */}
      {tab === "articles" && (
        <div>
          {articles.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>記事がありません。上のフォームから案件を登録してください。</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["タイトル / 主要KW", "地域", "ステータス", "公開日", "操作"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <ArticleRow key={a.id} article={a} onPublish={handlePublish} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "keywords" && (
        <div>
          {keywords.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>キーワードがありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["優先度", "キーワード", "地域", "意図", "月間検索数", "競合度"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.slice(0, 50).map((kw) => (
                  <KeywordRow key={kw.id} kw={kw} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "serp" && (
        <div>
          {snapshots.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>SERPスナップショットがありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["キーワード", "現在順位", "バケット", "取得日"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <SnapshotRow key={s.id} snap={s} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "gbp" && (
        <div>
          {strategy ? (
            <div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                最新案件 ({strategy.projectMeta.siteName}) の GBP 投稿スケジュール
              </p>
              <p style={{ fontSize: 13, color: "#374151" }}>
                週次 4 本の投稿テンプレートが自動生成されます。GBP 最終同期:{" "}
                {strategy.gbpLastSyncAt ? strategy.gbpLastSyncAt.slice(0, 10) : "未同期"}
              </p>
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: SAGE, marginBottom: 8 }}>生成投稿スケジュール</div>
                {[
                  "Week 1: 施工事例紹介投稿 (update)",
                  "Week 2: 無料相談キャンペーン (offer)",
                  "Week 3: Before/After フォト投稿 (photo)",
                  "Week 4: お客様の声 (update)",
                ].map((line) => (
                  <div key={line} style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    · {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>案件を登録するとGBPスケジュールが表示されます</p>
          )}
        </div>
      )}
    </div>
  );
}
