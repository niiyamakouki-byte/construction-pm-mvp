import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../domain/types.js";
import type { MessageType } from "../lib/chat-store.js";
import {
  getMessages,
  markAllAsRead,
  markAsRead,
  sendMessage,
} from "../lib/chat-store.js";

type Props = {
  projectId: string;
  /** Display name for the current user */
  currentUserName?: string;
  /** User ID for read tracking */
  currentUserId?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "今日";
  if (sameDay(d, yesterday)) return "昨日";
  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
  const diffDays = Math.floor(
    (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7) return `${weekDays[d.getDay()]}曜日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// Group messages by calendar date (YYYY-MM-DD key)
function groupByDate(
  msgs: ChatMessage[],
): { dateKey: string; label: string; messages: ChatMessage[] }[] {
  const map = new Map<string, ChatMessage[]>();
  for (const m of msgs) {
    const key = m.timestamp.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, messages]) => ({
      dateKey,
      label: formatDateLabel(messages[0].timestamp),
      messages,
    }));
}

// ── Message type badge config ─────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  MessageType,
  { label: string; bg: string; text: string }
> = {
  text: { label: "", bg: "", text: "" },
  inquiry: { label: "質疑", bg: "#fef3c7", text: "#92400e" },
  notice: { label: "周知", bg: "#dbeafe", text: "#1e40af" },
  image: { label: "画像", bg: "#f3e8ff", text: "#7e22ce" },
};

// ── Quick replies (current-field style, from Flutter) ────────────────────────

const QUICK_REPLIES = [
  { text: "了解", color: "#059669" },
  { text: "完了", color: "#2563eb" },
  { text: "確認します", color: "#d97706" },
  { text: "現場到着", color: "#7c3aed" },
  { text: "遅れます", color: "#dc2626" },
];

// ── Filter tabs ───────────────────────────────────────────────────────────────

type FilterType = "all" | MessageType;

const FILTER_TABS: { value: FilterType; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "text", label: "通常" },
  { value: "inquiry", label: "質疑" },
  { value: "notice", label: "周知" },
  { value: "image", label: "画像" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageTypeBadge({ type }: { type?: MessageType }) {
  if (!type || type === "text") return null;
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold mr-1.5"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function ReadStatus({
  msg,
  currentUserId,
}: {
  msg: ChatMessage;
  currentUserId: string;
}) {
  const isOwn = msg.userId === currentUserId;
  if (!isOwn) return null;
  const readCount = msg.readBy ? msg.readBy.filter((id) => id !== currentUserId).length : 0;
  if (readCount > 0) {
    return (
      <span className="text-[9px] text-blue-500 font-medium ml-1">
        既読 {readCount}
      </span>
    );
  }
  return <span className="text-[9px] text-slate-400 ml-1">送信済み</span>;
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-[11px] text-slate-400 font-medium shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProjectChat({
  projectId,
  currentUserName = "現場管理",
  currentUserId = "current-user",
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<MessageType>("text");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
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

  // Mark all visible messages as read when component mounts or messages change
  useEffect(() => {
    markAllAsRead(projectId, currentUserId);
    loadMessages();
  }, [projectId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(
    (e: React.FormEvent, overrideContent?: string) => {
      e.preventDefault();
      const content = (overrideContent ?? inputValue).trim();
      if (!content || submitting) return;

      setSubmitting(true);
      try {
        sendMessage(
          projectId,
          currentUserId,
          currentUserName,
          content,
          undefined,
          selectedType,
        );
        if (!overrideContent) setInputValue("");
        loadMessages();
      } finally {
        setSubmitting(false);
      }
    },
    [
      inputValue,
      submitting,
      projectId,
      currentUserId,
      currentUserName,
      selectedType,
      loadMessages,
    ],
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

  const handleQuickReply = useCallback(
    (text: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        sendMessage(
          projectId,
          currentUserId,
          currentUserName,
          text,
          undefined,
          "text",
        );
        loadMessages();
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, projectId, currentUserId, currentUserName, loadMessages],
  );

  const handleMessageClick = useCallback(
    (msg: ChatMessage) => {
      markAsRead(projectId, msg.id, currentUserId);
      loadMessages();
    },
    [projectId, currentUserId, loadMessages],
  );

  const filteredMessages =
    filterType === "all"
      ? messages
      : messages.filter((m) => (m.type ?? "text") === filterType);

  const unreadCount = messages.filter(
    (m) =>
      m.userId !== currentUserId &&
      (!m.readBy || !m.readBy.includes(currentUserId)),
  ).length;

  const groups = groupByDate(filteredMessages);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
        <span className="text-xs font-semibold text-slate-600 flex-1">
          プロジェクトチャット
          <span className="text-[10px] text-slate-400 font-normal ml-1">
            ({messages.length}件)
          </span>
        </span>
        {unreadCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            未読 {unreadCount}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-slate-100 bg-slate-50 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterType(tab.value)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filterType === tab.value
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
        {filteredMessages.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">
            {filterType === "all"
              ? "まだメッセージはありません。最初のメッセージを送ってみましょう。"
              : `「${FILTER_TABS.find((t) => t.value === filterType)?.label}」のメッセージはありません。`}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.dateKey}>
            <DateSeparator label={group.label} />
            {group.messages.map((msg, i) => {
              const prev = group.messages[i - 1];
              const showHeader =
                !prev ||
                prev.userId !== msg.userId ||
                new Date(msg.timestamp).getTime() -
                  new Date(prev.timestamp).getTime() >
                  5 * 60 * 1000;
              const initial = msg.userName.slice(0, 1);
              const color = avatarColor(msg.userName);
              const isOwn = msg.userId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}
                  onClick={() => handleMessageClick(msg)}
                >
                  {/* Avatar */}
                  {!isOwn && (
                    <div className="w-7 shrink-0">
                      {showHeader && (
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        >
                          {initial}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`flex flex-col gap-0.5 max-w-[260px] ${isOwn ? "items-end" : "items-start"}`}
                  >
                    {showHeader && !isOwn && (
                      <span className="text-xs font-semibold text-slate-600 ml-1">
                        {msg.userName}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        isOwn
                          ? "rounded-br-sm bg-blue-600 text-white"
                          : "rounded-bl-sm bg-slate-100 text-slate-700"
                      }`}
                      style={
                        isOwn
                          ? {}
                          : msg.type && msg.type !== "text"
                            ? {
                                backgroundColor:
                                  TYPE_CONFIG[msg.type].bg + "cc",
                              }
                            : {}
                      }
                    >
                      <MessageTypeBadge type={msg.type} />
                      {msg.content}
                    </div>
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <ul className="flex flex-col gap-0.5 mt-0.5">
                        {msg.attachments.map((a, ai) => (
                          <li
                            key={ai}
                            className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-blue-600"
                          >
                            <svg
                              className="h-3 w-3 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Timestamp + read status */}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] text-slate-400">
                        {formatTime(msg.timestamp)}
                      </span>
                      <ReadStatus msg={msg} currentUserId={currentUserId} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && inputValue === "" && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-1.5 border-t border-slate-100 bg-slate-50">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr.text}
              onClick={() => handleQuickReply(qr.text)}
              disabled={submitting}
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
              style={{
                borderColor: qr.color + "4d",
                backgroundColor: qr.color + "1a",
                color: qr.color,
              }}
            >
              {qr.text}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-200 px-4 py-3">
        {/* Message type selector */}
        <div className="flex gap-1 mb-2">
          {(["text", "inquiry", "notice"] as MessageType[]).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedType === t
                  ? "ring-1 ring-offset-0"
                  : "opacity-60 hover:opacity-80"
              }`}
              style={
                selectedType === t && t !== "text"
                  ? {
                      backgroundColor: TYPE_CONFIG[t].bg,
                      color: TYPE_CONFIG[t].text,
                      ringColor: TYPE_CONFIG[t].text,
                    }
                  : selectedType === t
                    ? { backgroundColor: "#e2e8f0", color: "#475569" }
                    : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
              }
            >
              {t === "text" ? "通常" : TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
        >
          <textarea
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowQuickReplies(e.target.value === "");
            }}
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
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
