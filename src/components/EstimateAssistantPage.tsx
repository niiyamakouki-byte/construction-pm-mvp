/**
 * AI見積アシスタント — チャットUI (Sprint 9-A)
 *
 * 左: 会話ログ (ユーザー/AI bubble)
 * 右: 松竹梅レンジ表 (リアルタイム更新)
 * useReducer + localStorage 永続化
 * LLM不使用、ルールベースのみ
 */
import { useReducer, useEffect, useRef, useCallback } from "react";
import { parseIntent } from "../lib/estimate-assistant/intent-parser.js";
import { lookupEstimate, summarizeRange, formatYen } from "../lib/estimate-assistant/cost-lookup.js";
import type { EstimateRange } from "../lib/estimate-assistant/cost-lookup.js";
import costMasterData from "../resources/cost-master.json";
import type { CostMaster } from "../lib/estimate-assistant/cost-lookup.js";

const costMaster = costMasterData as CostMaster;

// ── 型定義 ───────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type State = {
  messages: Message[];
  currentRange: EstimateRange | null;
  input: string;
};

type Action =
  | { type: "SET_INPUT"; payload: string }
  | { type: "SEND"; payload: { userMsg: Message; aiMsg: Message; range: EstimateRange } }
  | { type: "LOAD"; payload: State };

const STORAGE_KEY = "genbahub_estimate_assistant_v1";
const MAX_STORED = 60;

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "SEND": {
      const messages = [...state.messages, action.payload.userMsg, action.payload.aiMsg].slice(
        -MAX_STORED
      );
      return { ...state, messages, currentRange: action.payload.range, input: "" };
    }
    case "LOAD":
      return action.payload;
    default:
      return state;
  }
}

const initialState: State = {
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "こんにちは！お部屋の種類・広さ・ご希望のグレードをお気軽にお聞かせください。概算金額をすぐにご案内します。\n例：「LDK 20畳のリフォーム、標準グレードで」",
      timestamp: new Date().toISOString(),
    },
  ],
  currentRange: null,
  input: "",
};

// ── 永続化 ───────────────────────────────────────────────────────────────────

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return JSON.parse(raw) as State;
  } catch {
    return initialState;
  }
}

function saveState(state: State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

// ── フォーマットヘルパー ──────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── コンポーネント ────────────────────────────────────────────────────────────

export function EstimateAssistantPage() {
  const [state, dispatch] = useReducer(reducer, initialState, () => loadState());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 状態変化時に localStorage 保存
  useEffect(() => {
    saveState(state);
  }, [state]);

  // メッセージ追加時に末尾へスクロール
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messages]);

  const handleSend = useCallback(() => {
    const text = state.input.trim();
    if (!text) return;

    const intent = parseIntent(text);
    const range = lookupEstimate(intent, costMaster);
    const summary = summarizeRange(range);

    const userMsg: Message = {
      id: makeId(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const aiMsg: Message = {
      id: makeId(),
      role: "assistant",
      content: summary,
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: "SEND", payload: { userMsg, aiMsg, range } });
    inputRef.current?.focus();
  }, [state.input]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-screen bg-stone-50 text-slate-800">
      {/* 左: 会話ログ */}
      <div className="flex flex-col flex-1 border-r border-stone-200">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-stone-200 bg-white">
          <h1 className="text-base font-semibold text-slate-700">AI見積アシスタント</h1>
          <p className="text-xs text-slate-400 mt-0.5">部屋・広さ・グレードを話しかけるだけで概算を表示</p>
        </div>

        {/* メッセージリスト */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {state.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-sage-100 text-slate-800 bg-emerald-100"
                    : "bg-white border border-stone-200 text-slate-700"
                }`}
              >
                {msg.content}
                <div className="text-[10px] text-slate-400 mt-1 text-right">
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力欄 */}
        <div className="px-4 py-3 border-t border-stone-200 bg-white flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={state.input}
            onChange={(e) => dispatch({ type: "SET_INPUT", payload: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="例: リビング 15畳、ハイグレードで壁紙張替え"
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-stone-50"
          />
          <button
            onClick={handleSend}
            disabled={!state.input.trim()}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-emerald-700 transition-colors"
          >
            送信
          </button>
        </div>
      </div>

      {/* 右: 松竹梅レンジ表 */}
      <div className="w-80 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-slate-700">概算レンジ（税込）</h2>
        </div>

        {state.currentRange ? (
          <RangeTable range={state.currentRange} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400 text-center px-6">
              要望を入力すると<br />ここに概算レンジが表示されます
            </p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-stone-200 text-[11px] text-slate-400">
          📍 世田谷区標準価格。現地調査後に±20%変動します。
        </div>
      </div>
    </div>
  );
}

// ── レンジ表サブコンポーネント ────────────────────────────────────────────────

function RangeTable({ range }: { range: EstimateRange }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {/* 合計サマリ */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <GradeCell label="エコノミー" amount={range.taxIncludedLow} color="text-blue-600" />
        <GradeCell label="標準" amount={range.taxIncludedMid} color="text-emerald-700" highlight />
        <GradeCell label="ハイグレード" amount={range.taxIncludedHigh} color="text-amber-700" />
      </div>

      {/* 品目明細 */}
      {range.items.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-400 mb-1">内訳（税抜）</p>
          <div className="space-y-2">
            {range.items.map((item, i) => (
              <div key={i} className="text-xs border-b border-stone-100 pb-2">
                <div className="font-medium text-slate-700 truncate">{item.name}</div>
                <div className="text-slate-400">
                  {item.qty}
                  {item.unit} ×
                </div>
                <div className="grid grid-cols-3 gap-1 mt-0.5 text-[11px]">
                  <span className="text-blue-500">{formatYen(item.unitPriceLow)}</span>
                  <span className="text-emerald-600 font-medium">{formatYen(item.unitPriceMid)}</span>
                  <span className="text-amber-600">{formatYen(item.unitPriceHigh)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GradeCell({
  label,
  amount,
  color,
  highlight = false,
}: {
  label: string;
  amount: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md py-2 px-1 ${highlight ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-stone-50"}`}
    >
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${color}`}>{formatYen(amount)}</div>
    </div>
  );
}
