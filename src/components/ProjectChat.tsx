import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../domain/types.js";
import { getMessages, sendMessage } from "../lib/chat-store.js";

type Props = {
  projectId: string;
  /** Display name for the current user */
  currentUserName?: string;
};

function avatarColor(name: string): string {
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#d97706",
    "#dc2626",
    "#0891b2",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function ProjectChat({ projectId, currentUserName = "現場管理" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(() => {
    const msgs = getMessages(projectId);
    setMessages(msgs);
  }, [projectId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const content = inputValue.trim();
      if (!content || submitting) return;

      setSubmitting(true);
      try {
        sendMessage(projectId, currentUserName, currentUserName, content);
        setInputValue("");
        loadMessages();
      } finally {
        setSubmitting(false);
      }
    },
    [inputValue, submitting, projectId, currentUserName, loadMessages],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">
            まだメッセージはありません。最初のメッセージを送ってみましょう。
          </p>
        )}
        {messages.map((msg) => {
          const initial = msg.userName.slice(0, 1);
          const color = avatarColor(msg.userName);
          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              >
                {initial}
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {msg.userName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 max-w-[260px] whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <ul className="flex flex-col gap-0.5 mt-1">
                    {msg.attachments.map((a, i) => (
                      <li key={i} className="text-[10px] text-brand-600 underline">
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none max-h-24"
            disabled={submitting}
            aria-label="メッセージ入力"
          />
          <button
            type="submit"
            disabled={submitting || !inputValue.trim()}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-40"
            aria-label="送信"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
        <p className="mt-1 text-[10px] text-slate-400">
          Enter で送信 / Shift+Enter で改行
        </p>
      </div>
    </div>
  );
}
