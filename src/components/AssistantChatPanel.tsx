import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
};

const STORAGE_KEY = "genbahub_assistant_chat";
const MAX_STORED = 50;
const POLL_INTERVAL_MS = 2000;

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable (e.g. private mode quota)
  }
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Props = {
  /** ユーザー識別子。ログイン不要の demo 画面は "demo-user" を渡す */
  userId?: string;
};

export function AssistantChatPanel({ userId = "demo-user" }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastMessageId, setLastMessageId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初回マウント時に最新メッセージIDを設定
  useEffect(() => {
    const stored = loadHistory();
    if (stored.length > 0) {
      const last = stored[stored.length - 1];
      if (last.role === "bot") {
        setLastMessageId(last.id);
      }
    }
  }, []);

  // メッセージ追加ヘルパー
  const addMessages = useCallback((newMsgs: ChatMessage[]) => {
    setMessages((prev) => {
      const merged = [...prev, ...newMsgs];
      saveHistory(merged);
      return merged;
    });
  }, []);

  // Discord polling
  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const params = new URLSearchParams({ userId });
        if (lastMessageId) params.set("after", lastMessageId);

        const res = await fetch(`/api/chat/poll?${params.toString()}`);
        if (!res.ok) return;

        const data = (await res.json()) as {
          messages: Array<{ id: string; content: string; timestamp: string }>;
        };

        if (data.messages.length > 0) {
          const newMsgs: ChatMessage[] = data.messages.map((m) => ({
            id: m.id,
            role: "bot",
            content: m.content,
            timestamp: m.timestamp,
          }));

          const newestId = data.messages[data.messages.length - 1].id;
          setLastMessageId(newestId);
          addMessages(newMsgs);

          if (!open) {
            setUnread((n) => n + newMsgs.length);
          }
        }
      } catch {
        // ネットワークエラーは無視（次のポーリングで再試行）
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [userId, lastMessageId, open, addMessages]);

  // 展開時にスクロール & 未読クリア
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // メッセージ追加時に自動スクロール
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setInput("");
    setSending(true);
    addMessages([optimistic]);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, text }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        addMessages([
          {
            id: `err-${Date.now()}`,
            role: "bot",
            content: `[送信エラー] ${err.error ?? "不明なエラーが発生しました"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      addMessages([
        {
          id: `err-${Date.now()}`,
          role: "bot",
          content: "[送信エラー] ネットワーク接続を確認してください",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, userId, addMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end"
      aria-label="ラポルタ秘書チャット"
    >
      {/* チャットウィンドウ */}
      {open && (
        <div
          className="mb-3 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ width: 350, height: 500 }}
          role="dialog"
          aria-modal="true"
          aria-label="ラポルタ秘書チャット"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                AI
              </div>
              <div>
                <div className="text-sm font-semibold">ラポルタ秘書</div>
                <div className="text-xs text-blue-200">Discord 中継</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-white/20"
              aria-label="チャットを閉じる"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">
                <div className="text-2xl mb-2">💬</div>
                <div>何でも聞いてください</div>
                <div className="text-xs mt-1">現場管理・見積・スケジュールなど</div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div
                    className={`mt-1 text-xs ${
                      msg.role === "user" ? "text-blue-200 text-right" : "text-slate-400"
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div className="border-t border-slate-100 bg-white px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力... (Enter で送信)"
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none"
                rows={2}
                maxLength={2000}
                aria-label="メッセージ入力"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="送信"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB ボタン */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        aria-label={open ? "チャットを閉じる" : "ラポルタ秘書を開く"}
        data-testid="assistant-chat-fab"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
        {unread > 0 && !open && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse"
            aria-label={`${unread}件の新着メッセージ`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
