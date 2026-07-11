/**
 * OwnerShareTokenPanel — PM側: 施主用URLを生成・管理するパネル
 * /share-tokens
 */

import { useEffect, useId, useState } from "react";
import {
  generateShareToken,
  listShareTokens,
  revokeShareToken,
} from "../lib/owner-app/share-token.js";
import { createProjectRepository } from "../stores/project-store.js";
import type { Project } from "../domain/types.js";

type TokenEntry = {
  token: string;
  expiresAt: number;
  revoked: boolean;
};

type ProjectRow = {
  project: Project;
  tokens: TokenEntry[];
};

function buildOwnerUrl(projectId: string, token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/owner-app/${encodeURIComponent(projectId)}?token=${token}`;
}

function ExpiryBadge({ expiresAt, revoked }: { expiresAt: number; revoked: boolean }) {
  if (revoked) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: "#C53030" }}>
        無効
      </span>
    );
  }
  const expired = Date.now() > expiresAt;
  if (expired) {
    return (
      <span className="rounded-full bg-slate-300 px-2 py-0.5 text-[10px] text-white">
        期限切れ
      </span>
    );
  }
  const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] text-white"
      style={{ background: "#6B8E5A" }}
    >
      {days}日残
    </span>
  );
}

function TokenRow({
  projectId,
  entry,
  onRevoke,
}: {
  projectId: string;
  entry: TokenEntry;
  onRevoke: (token: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = buildOwnerUrl(projectId, entry.token);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const active = !entry.revoked && Date.now() <= entry.expiresAt;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <span className="flex-1 truncate font-mono text-slate-500">{url}</span>
      <ExpiryBadge expiresAt={entry.expiresAt} revoked={entry.revoked} />
      {active && (
        <button
          onClick={handleCopy}
          className="rounded px-2 py-1 text-white text-[10px]"
          style={{ background: "#6B8E5A" }}
        >
          {copied ? "コピー済" : "コピー"}
        </button>
      )}
      {active && (
        <button
          onClick={() => onRevoke(entry.token)}
          className="rounded px-2 py-1 text-[10px] text-white"
          style={{ background: "#C53030" }}
        >
          無効化
        </button>
      )}
    </div>
  );
}

const EXPIRY_OPTIONS = [
  { label: "7日間", days: 7 },
  { label: "30日間", days: 30 },
  { label: "90日間", days: 90 },
];

function IssueForm({
  projectId,
  onIssue,
  onCancel,
}: {
  projectId: string;
  onIssue: (days: number, password: string) => void;
  onCancel: () => void;
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onIssue(days, password)}
          className="rounded-lg px-3 py-1.5 text-xs text-white"
          style={{ background: "#6B8E5A" }}
        >
          発行する
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
  row,
  onGenerate,
  onRevoke,
}: {
  row: ProjectRow;
  onGenerate: (projectId: string, days: number, password: string) => void;
  onRevoke: (token: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const active = row.tokens.filter(
    (t) => !t.revoked && Date.now() <= t.expiresAt,
  );

  function handleIssue(days: number, password: string) {
    onGenerate(row.project.id, days, password);
    setShowForm(false);
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{row.project.name}</h2>
          <p className="text-xs text-slate-400">ID: {row.project.id}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg px-3 py-1.5 text-xs text-white"
            style={{ background: "#6B8E5A" }}
          >
            共有リンクを発行
          </button>
        )}
      </div>

      {showForm && (
        <IssueForm
          projectId={row.project.id}
          onIssue={handleIssue}
          onCancel={() => setShowForm(false)}
        />
      )}

      {row.tokens.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">URLはまだ発行されていません</p>
      ) : (
        <div className="mt-3 space-y-2">
          {row.tokens.map((t) => (
            <TokenRow
              key={t.token}
              projectId={row.project.id}
              entry={t}
              onRevoke={onRevoke}
            />
          ))}
        </div>
      )}

      {active.length > 0 && (
        <p className="mt-2 text-[10px] text-slate-400">
          有効URL: {active.length}件
        </p>
      )}
    </div>
  );
}

export function OwnerShareTokenPanel() {
  const [rows, setRows] = useState<ProjectRow[]>([]);

  async function loadProjects() {
    const repo = createProjectRepository();
    const projects = await repo.findAll();
    const next: ProjectRow[] = projects.map((p) => ({
      project: p,
      tokens: listShareTokens(p.id),
    }));
    setRows(next);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function handleGenerate(projectId: string, days: number, _password: string) {
    // password is intentionally not stored in the owner-app token (stored separately in JWT flow)
    generateShareToken(projectId, days);
    setRows((prev) =>
      prev.map((r) =>
        r.project.id === projectId
          ? { ...r, tokens: listShareTokens(projectId) }
          : r,
      ),
    );
  }

  function handleRevoke(token: string) {
    revokeShareToken(token);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        tokens: listShareTokens(r.project.id),
      })),
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">施主URL管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            施主専用ダッシュボードのアクセスURLを発行・管理します
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">案件がありません</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <ProjectPanel
                key={row.project.id}
                row={row}
                onGenerate={handleGenerate}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
