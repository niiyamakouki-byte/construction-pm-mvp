/**
 * OwnerShareTokenPanel — PM側: 施主用URLを生成するパネル
 * /share-tokens
 *
 * Sprint 66 移行 (2026-07-27, bd委譲・クロスデバイス修正):
 *   旧実装は owner-app/share-token.ts のトークンを localStorage にのみ保存していたため、
 *   発行した端末以外（施主のスマホ等）でリンクを開くと必ず not_found になった
 *   （PMと施主が同じブラウザを共有しない限り機能しない致命的な不具合。実測は
 *   src/lib/owner-app/__tests__/share-token.test.ts の cross-device テストを参照）。
 *   本パネルは /api/share-token（HMAC-SHA256署名、サーバー専用鍵 SHARE_TOKEN_SECRET）
 *   経由でトークンを発行するよう変更した。署名検証はどの端末からでもサーバーが
 *   行うため、別端末で開いても正しく検証できる。
 *
 *   署名トークンはステートレス（サーバーはDBを持たず署名鍵のみで検証する設計）なので、
 *   発行済みトークンの永続一覧・無効化(revoke)機能は提供しない。これらは新しい
 *   永続ストアの新設が必要になり、今回の委譲範囲外（「新しいストレージ層を勝手に
 *   増やさない」の方針）。発行直後にその場でコピーできるURLのみを表示する。
 */

import { useEffect, useId, useState } from "react";
import { createShareToken } from "../lib/share-token.js";
import { useAuth } from "../contexts/AuthContext.js";
import { createProjectRepository } from "../stores/project-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import type { Project } from "../domain/types.js";

function buildShareUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/portal/share/${encodeURIComponent(token)}`;
}

const EXPIRY_OPTIONS = [
  { label: "7日間", days: 7 },
  { label: "30日間", days: 30 },
  { label: "90日間", days: 90 },
];

type IssuedLink = {
  url: string;
};

function IssueForm({
  onIssue,
  onCancel,
  issuing,
  error,
}: {
  onIssue: (days: number, password: string) => void;
  onCancel: () => void;
  issuing: boolean;
  error: string | null;
}) {
  const [days, setDays] = useState(30);
  const [password, setPassword] = useState("");
  const passwordInputId = useId();

  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
      <p className="mb-2 font-semibold text-slate-700">共有リンクを発行</p>
      <div className="mb-3">
        <p className="mb-1 text-slate-500">有効期限</p>
        <div className="flex gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              aria-pressed={days === opt.days}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
              style={
                days === opt.days
                  ? { background: "#6B8E5A", color: "#fff" }
                  : { background: "#e2e8f0", color: "#475569" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label htmlFor={passwordInputId} className="mb-1 block text-slate-500">パスワード（任意）</label>
        <input
          id={passwordInputId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="未入力でパスワードなし"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#6B8E5A]"
        />
      </div>
      {error && <p className="mb-2 text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={issuing}
          onClick={() => onIssue(days, password)}
          className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-60"
          style={{ background: "#6B8E5A" }}
        >
          {issuing ? "発行中..." : "発行する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs text-slate-600"
          style={{ background: "#e2e8f0" }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function ProjectPanel({
  project,
  getAccessToken,
}: {
  project: Project;
  getAccessToken: () => Promise<string | null>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleIssue(days: number, password: string) {
    setIssuing(true);
    setError(null);
    try {
      const token = await createShareToken(project.id, {
        expiresInDays: days,
        password: password || undefined,
        getAccessToken,
      });
      setIssued({ url: buildShareUrl(token) });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "発行に失敗しました");
    } finally {
      setIssuing(false);
    }
  }

  function handleCopy() {
    if (!issued) return;
    navigator.clipboard.writeText(issued.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{project.name}</h2>
          <p className="text-xs text-slate-400">ID: {project.id}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setError(null);
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-white"
            style={{ background: "#6B8E5A" }}
          >
            共有リンクを発行
          </button>
        )}
      </div>

      {showForm && (
        <IssueForm
          onIssue={handleIssue}
          onCancel={() => setShowForm(false)}
          issuing={issuing}
          error={error}
        />
      )}

      {issued && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="flex-1 truncate font-mono text-slate-500">{issued.url}</span>
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 text-white text-[10px]"
            style={{ background: "#6B8E5A" }}
          >
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>
      )}

      {!issued && !showForm && (
        <p className="mt-2 text-xs text-slate-400">URLはまだ発行されていません</p>
      )}
      {issued && (
        <p className="mt-2 text-[10px] text-slate-400">
          このURLは施主に送付してください。一覧には保存されません（再度開くと消えますが、発行済みのリンク自体は有効期限まで引き続き利用できます）。
        </p>
      )}
    </div>
  );
}

export function OwnerShareTokenPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { session } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const repo = createProjectRepository();
    repo.findAll().then((all) => {
      if (!cancelled) setProjects(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function getAccessToken(): Promise<string | null> {
    return session?.access_token ?? null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            ← 案件一覧へ戻る
          </button>
          <h1 className="text-xl font-bold text-slate-800">施主URL管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            施主専用ダッシュボードのアクセスURLを発行します
          </p>
        </header>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">案件がありません</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <ProjectPanel
                key={project.id}
                project={project}
                getAccessToken={getAccessToken}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
