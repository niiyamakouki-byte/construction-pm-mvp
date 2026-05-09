/**
 * 現場AIチャットアシスタント — UI (Sprint 12-A)
 *
 * 職人/監督が困りごとを入力すると、過去事例DBから解決策3件を提示する。
 * 外部API/LLM不使用。純Regex + localStorage + rule_based のみ。
 * v2-cozy: セージグリーン #6B8E5A、装飾最小
 */

import { useReducer, useEffect, useCallback, useRef } from "react";
import { suggestSolutions } from "../lib/site-ai-assistant/solution-engine.js";
import { getPastCaseStore, resetPastCaseStore } from "../lib/site-ai-assistant/case-store.js";
import type { Issue, Solution, AssistantResponse } from "../lib/site-ai-assistant/types.js";

// ── 定数 ─────────────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const MAX_HISTORY = 10;
const DEMO_PROJECTS = [
  { id: "proj-1", name: "南青山マンション改装" },
  { id: "proj-2", name: "世田谷戸建てリフォーム" },
  { id: "proj-3", name: "渋谷店舗新築" },
];

// ── 型定義 ───────────────────────────────────────────────────────────────────

type HistoryEntry = {
  issue: Issue;
  response: AssistantResponse;
};

type State = {
  text: string;
  projectId: string;
  loading: boolean;
  currentResponse: AssistantResponse | null;
  history: HistoryEntry[];
};

type Action =
  | { type: "SET_TEXT"; payload: string }
  | { type: "SET_PROJECT"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_RESPONSE"; payload: { issue: Issue; response: AssistantResponse } };

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TEXT":
      return { ...state, text: action.payload };
    case "SET_PROJECT":
      return { ...state, projectId: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_RESPONSE": {
      const entry: HistoryEntry = {
        issue: action.payload.issue,
        response: action.payload.response,
      };
      const history = [entry, ...state.history].slice(0, MAX_HISTORY);
      return {
        ...state,
        currentResponse: action.payload.response,
        history,
        text: "",
        loading: false,
      };
    }
    default:
      return state;
  }
}

const initialState: State = {
  text: "",
  projectId: DEMO_PROJECTS[0].id,
  loading: false,
  currentResponse: null,
  history: [],
};

// ── コンポーネント ────────────────────────────────────────────────────────────

export function SiteAssistantPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 初回: シードデータを投入
  useEffect(() => {
    const store = getPastCaseStore();
    store.seed();
  }, []);

  const handleSubmit = useCallback(() => {
    const text = state.text.trim();
    if (!text || state.loading) return;

    dispatch({ type: "SET_LOADING", payload: true });

    const issue: Issue = {
      id: `issue-${Date.now()}`,
      projectId: state.projectId,
      postedBy: "現場スタッフ",
      text,
      postedAt: new Date().toISOString(),
    };

    const store = getPastCaseStore();
    const response = suggestSolutions(issue, store);

    dispatch({ type: "SET_RESPONSE", payload: { issue, response } });
    textareaRef.current?.focus();
  }, [state.text, state.projectId, state.loading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-screen bg-stone-50 text-slate-800 overflow-hidden">
      {/* メインエリア */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* ヘッダー */}
        <header className="px-5 py-3 border-b border-stone-200 bg-white flex items-center gap-3">
          <div
            className="w-2 h-6 rounded-full"
            style={{ backgroundColor: SAGE_GREEN }}
            aria-hidden="true"
          />
          <div>
            <h1 className="text-base font-semibold text-slate-700">現場AIアシスタント</h1>
            <p className="text-xs text-slate-400">困りごとを書くと、過去事例から解決策を提案します</p>
          </div>
        </header>

        {/* 入力フォーム */}
        <section className="px-5 py-4 border-b border-stone-200 bg-white">
          <div className="flex gap-3 mb-2">
            <label className="text-xs text-slate-500 mt-2 shrink-0">現場</label>
            <select
              value={state.projectId}
              onChange={(e) => dispatch({ type: "SET_PROJECT", payload: e.target.value })}
              className="text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {DEMO_PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={state.text}
              onChange={(e) => dispatch({ type: "SET_TEXT", payload: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="例: 塗料が足りなくなりました。納品まで3日かかります。どうすればいいですか？"
              rows={3}
              className="flex-1 resize-none rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-stone-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!state.text.trim() || state.loading}
              className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-40 transition-colors self-end"
              style={{ backgroundColor: SAGE_GREEN }}
            >
              質問する
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ctrl+Enter でも送信</p>
        </section>

        {/* 解決策カード */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {state.currentResponse ? (
            <>
              {state.currentResponse.fallbackMessage && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                  {state.currentResponse.fallbackMessage}
                </p>
              )}
              {state.currentResponse.suggestedSolutions.map((sol, i) => (
                <SolutionCard key={sol.id} solution={sol} rank={i + 1} />
              ))}
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-slate-400">困りごとを入力すると解決策が表示されます</p>
            </div>
          )}
        </div>
      </div>

      {/* 履歴サイドバー */}
      <aside className="w-72 border-l border-stone-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-slate-600">直近の質問</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {state.history.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">まだ質問がありません</p>
          ) : (
            <ul>
              {state.history.map((entry, i) => (
                <HistoryItem key={`${entry.issue.id}-${i}`} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── サブコンポーネント ────────────────────────────────────────────────────────

function SolutionCard({ solution, rank }: { solution: Solution; rank: number }) {
  const confidencePct = Math.round(solution.confidence * 100);
  const sourceLabel =
    solution.source === "past_case"
      ? "過去事例"
      : solution.source === "rule_based"
        ? "汎用ガイド"
        : "手動入力";

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0"
            style={{ backgroundColor: SAGE_GREEN }}
          >
            {rank}
          </span>
          <p className="text-sm font-medium text-slate-700">{solution.summary}</p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{sourceLabel}</span>
      </div>

      {/* 手順リスト */}
      <ol className="space-y-1 mt-2 mb-3">
        {solution.steps.map((step, i) => (
          <li key={i} className="text-xs text-slate-600 flex gap-1.5">
            <span className="text-slate-400 shrink-0">{i + 1}.</span>
            <span>{step.replace(/^\d+\.\s*/, "")}</span>
          </li>
        ))}
      </ol>

      {/* confidence メーター + 採用ボタン */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>信頼度</span>
            <span>{confidencePct}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidencePct}%`,
                backgroundColor: SAGE_GREEN,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md border font-medium transition-colors"
          style={{ borderColor: SAGE_GREEN, color: SAGE_GREEN }}
          onClick={() => {
            // 採用: 将来の LLM 接続や GenbaHub 連携ポイント
          }}
        >
          採用
        </button>
      </div>
    </div>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const time = new Date(entry.issue.postedAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="px-4 py-3 border-b border-stone-100 hover:bg-stone-50 cursor-default">
      <p className="text-xs text-slate-700 line-clamp-2">{entry.issue.text}</p>
      <p className="text-[10px] text-slate-400 mt-1">
        {time} · {entry.response.suggestedSolutions.length}件の提案
      </p>
    </li>
  );
}

// テスト用エクスポート
export { resetPastCaseStore };
