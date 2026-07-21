/**
 * AssistantChatPanel — ラポルタ秘書チャット (Sprint 3-3 v2-cozy)
 *
 * 変更点:
 * - v2-cozy カラー (ベージュ/セージグリーン) に全面刷新
 * - 吹き出し型メッセージ (秘書=左/ベージュ, ユーザー=右/セージグリーン)
 * - framer-motion で開閉アニメーション (slide-up 0.3s)
 * - スラッシュコマンド5本をローカル処理 (API課金ゼロ)
 * - 初回起動時の挨拶メッセージ
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { handleInput } from "../lib/assistantCommands.js";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
};

const STORAGE_KEY = "genbahub_assistant_chat_v3";
const POS_KEY = "genbahub_chat_pos";
const SIZE_KEY = "genbahub_chat_size";
const MAX_STORED = 50;
const POLL_INTERVAL_MS = 2000;

const MIN_W = 320;
const MIN_H = 400;
const FAB_SIZE = 56;
const FAB_RADIUS = FAB_SIZE / 2;
const FAB_EDGE_GAP = 20;
const MOBILE_BREAKPOINT = 768;
const MOBILE_NAV_CLEARANCE = 92;
const PANEL_EDGE_GAP = 16;

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
    // localStorage unavailable
  }
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { x: number; y: number };
  } catch {
    return null;
  }
}

function savePos(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function loadSize(): { w: number; h: number } | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { w: number; h: number };
  } catch {
    return null;
  }
}

function saveSize(size: { w: number; h: number }): void {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {
    // ignore
  }
}

function defaultPos(): { x: number; y: number } {
  const mobileBottomOffset = window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_NAV_CLEARANCE : 0;
  const desiredLeft = window.innerWidth - FAB_SIZE - FAB_EDGE_GAP;
  const desiredTop = window.innerHeight - FAB_SIZE - FAB_EDGE_GAP - mobileBottomOffset;
  return {
    x: desiredLeft + FAB_RADIUS,
    y: desiredTop + FAB_RADIUS,
  };
}

function defaultSize(): { w: number; h: number } {
  return { w: 350, h: 500 };
}

function clampPanelPos(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const compactMode = w <= FAB_SIZE && h <= FAB_SIZE;
  const bottomInset = compactMode && vw < MOBILE_BREAKPOINT ? MOBILE_NAV_CLEARANCE : 0;
  const edge = compactMode ? 0 : PANEL_EDGE_GAP;
  return {
    x: Math.max(edge, Math.min(x, vw - w - edge)),
    y: Math.max(edge, Math.min(y, vh - h - edge - bottomInset)),
  };
}

/** 初回起動挨拶メッセージ */
const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-0",
  role: "bot",
  content:
    "こんにちは！ラポルタ秘書でございます 🌿\n" +
    "現場管理・見積・工程・安全管理などをお手伝いいたします。\n" +
    "`/help` でコマンド一覧をご覧になれます。",
  timestamp: new Date().toISOString(),
};

type Props = {
  userId?: string;
  /** ハンバーガーメニュー/その他ドロワーなど、より優先度の高い固定オーバーレイが
   * 開いている間、折りたたみ時のFAB(丸ボタン)だけを非表示にする。
   * ドロワー類はz-indexがFABより低いため、表示したままだとFABがドロワーの
   * ボタン群の上に重なって表示されてしまう(bead: menu-fab-overlap)。 */
  hideFab?: boolean;
};

export function AssistantChatPanel({ userId = "demo-user", hideFab = false }: Props) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const history = loadHistory();
    // 履歴が空なら挨拶メッセージを追加
    if (history.length === 0) return [WELCOME_MESSAGE];
    return history;
  });
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [lastMessageId, setLastMessageId] = useState<string | undefined>(() => {
    const stored = loadHistory();
    if (stored.length > 0) {
      const last = stored[stored.length - 1];
      if (last.role === "bot") return last.id;
    }
    return undefined;
  });

  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? defaultPos());
  const [size, setSize] = useState<{ w: number; h: number }>(() => loadSize() ?? defaultSize());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startMouseX: number; startMouseY: number; startW: number; startH: number } | null>(null);
  const showFab = viewportWidth < MOBILE_BREAKPOINT;

  // モバイルはFABが固定位置で浮くため、スクロール中はダッシュボードの数値等を隠さないよう半透明化する
  // (construction_pm_mvp mobile squad 2026-07-07: 本日の入場者カード等の右端数値がFABに隠れる不具合の修正)
  const [isScrolling, setIsScrolling] = useState(false);
  useEffect(() => {
    if (!showFab) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsScrolling(false), 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timeoutId);
    };
  }, [showFab]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setPos((current) => {
        if (window.innerWidth < MOBILE_BREAKPOINT) {
          return clampPanelPos(current.x, current.y, open ? size.w : FAB_SIZE, open ? size.h : FAB_SIZE);
        }
        if (!open) {
          return defaultPos();
        }
        return clampPanelPos(current.x, current.y, size.w, size.h);
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, size.h, size.w]);

  // ⌘K / Ctrl+K でトグル
  useEffect(() => {
    const openFromShell = () => {
      setUnread(0);
      setPos((p) => clampPanelPos(p.x, p.y, size.w, size.h));
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.startsWith("Mac");
      const trigger = isMac ? e.metaKey && e.key.toLowerCase() === "k" : e.ctrlKey && e.key.toLowerCase() === "k";
      if (trigger) {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setUnread(0);
            setPos((p) => clampPanelPos(p.x, p.y, size.w, size.h));
          }
          return !v;
        });
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("genbahub:assistant-open", openFromShell);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("genbahub:assistant-open", openFromShell);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, size.w, size.h]);

  const addMessages = useCallback((newMsgs: ChatMessage[]) => {
    setMessages((prev) => {
      const merged = [...prev, ...newMsgs];
      saveHistory(merged);
      return merged;
    });
  }, []);

  // パネルが閉じている / タブが非表示の間はポーリングを止める
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      setPageVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Discord polling（既存の非コマンドメッセージを補完）
  // パネル表示中 かつ タブがアクティブな間だけポーリングする
  useEffect(() => {
    if (!open || !pageVisible) return;

    let active = true;

    const poll = async () => {
      if (!active) return;
      // Vite dev サーバーには /api/* serverless function ハンドラがないため dev では polling skip
      // (vite:esbuild がメアド末尾 .jp を loader と誤認識して overlay エラー化するのも回避)
      if (import.meta.env.DEV) return;
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
            role: "bot" as const,
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
        // ネットワークエラーは無視
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [userId, lastMessageId, open, pageVisible, addMessages]);

  // 展開時: スクロール (未読クリア・位置クランプはopenPanel/togglePanelで行う)
  useEffect(() => {
    if (open) {
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

  // ドラッグ
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dy = ev.clientY - dragRef.current.startMouseY;
      const newX = dragRef.current.startPosX + dx;
      const newY = dragRef.current.startPosY + dy;
      const clamped = clampPanelPos(newX, newY, open ? size.w : 56, open ? size.h : 56);
      setPos(clamped);
    };

    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dy = ev.clientY - dragRef.current.startMouseY;
      const newX = dragRef.current.startPosX + dx;
      const newY = dragRef.current.startPosY + dy;
      const clamped = clampPanelPos(newX, newY, open ? size.w : 56, open ? size.h : 56);
      savePos(clamped);
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos, open, size]);

  // リサイズ
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: size.w,
      startH: size.h,
    };

    const maxW = Math.floor(window.innerWidth * 0.6);
    const maxH = Math.floor(window.innerHeight * 0.6);

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startMouseX;
      const dy = ev.clientY - resizeRef.current.startMouseY;
      const newW = Math.max(MIN_W, Math.min(resizeRef.current.startW + dx, maxW));
      const newH = Math.max(MIN_H, Math.min(resizeRef.current.startH + dy, maxH));
      setSize({ w: newW, h: newH });
    };

    const onUp = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startMouseX;
      const dy = ev.clientY - resizeRef.current.startMouseY;
      const newW = Math.max(MIN_W, Math.min(resizeRef.current.startW + dx, maxW));
      const newH = Math.max(MIN_H, Math.min(resizeRef.current.startH + dy, maxH));
      saveSize({ w: newW, h: newH });
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [size]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setInput("");
    addMessages([userMsg]);

    // コマンド処理（ローカル完結・API不使用）
    const result = handleInput(text);
    const botMsg: ChatMessage = {
      id: `bot-${Date.now() + 1}`,
      role: "bot",
      content: result.text,
      timestamp: new Date().toISOString(),
    };
    addMessages([botMsg]);
  }, [input, addMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 展開中はドラッグ位置(pos)を尊重するが、折りたたみ時のFABは
  // localStorageに残ったドラッグ座標(別デバイス/別ビューポートでの古い値を含む)に
  // 依存させず、常に画面右下+セーフエリアへCSSで固定する(bead: leaf-fab-midscreen再発防止)。
  // 過去の修正(012877f/7d89cb5)はカード側の余白確保のみでFAB自体の位置ソースは
  // 未修正だったため、ドラッグ後の pos が再読み込みされて画面中腹に出る再発を止められなかった。
  const fabStyle: React.CSSProperties = open
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
      }
    : {
        position: "fixed",
        right: `calc(${FAB_EDGE_GAP}px + env(safe-area-inset-right, 0px))`,
        bottom: `calc(${MOBILE_NAV_CLEARANCE + FAB_EDGE_GAP}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 50,
      };

  const isMac = typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  return (
    <div style={fabStyle}>
      {/* チャットウィンドウ (framer-motion slide-up) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            ref={dialogRef}
            className="flex flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{
              width: size.w,
              height: size.h,
              background: "#FDF8F0",
              border: "1px solid #E8DFD3",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="ラポルタ秘書チャット"
          >
            {/* ヘッダー */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none"
              style={{ background: "#7BA88A", color: "#fff" }}
              onMouseDown={onDragStart}
            >
              <div className="flex items-center gap-2">
                {/* アバター */}
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.25)" }}
                >
                  <Leaf className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold">ラポルタ秘書</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                    現場管理アシスタント
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs mr-1 hidden sm:block" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {shortcutLabel}
                </span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ background: "rgba(255,255,255,0)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0)"; }}
                  aria-label="チャットを閉じる"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* メッセージ一覧 */}
            <div
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
              style={{ background: "#F5F0E8" }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* 秘書アバター (左) */}
                  {msg.role === "bot" && (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "#E8F2EB" }}
                    >
                      <Leaf className="h-4 w-4" style={{ color: "#7BA88A" }} aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                    style={
                      msg.role === "user"
                        ? {
                            background: "#7BA88A",
                            color: "#fff",
                            borderBottomRightRadius: "4px",
                          }
                        : {
                            background: "#FDF8F0",
                            color: "#3D3529",
                            border: "1px solid #E8DFD3",
                            borderBottomLeftRadius: "4px",
                          }
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    <div
                      className="mt-1 text-xs"
                      style={
                        msg.role === "user"
                          ? { color: "rgba(255,255,255,0.7)", textAlign: "right" }
                          : { color: "#A69E93" }
                      }
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 入力エリア */}
            <div
              className="px-3 py-3"
              style={{ background: "#FDF8F0", borderTop: "1px solid #E8DFD3" }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  id="assistant-chat-input"
                  name="assistantChatInput"
                  autoComplete="off"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力してください"
                  className="flex-1 resize-none text-sm focus:outline-none"
                  style={{
                    borderRadius: "14px",
                    border: "1px solid #E8DFD3",
                    background: "#F5F0E8",
                    color: "#3D3529",
                    padding: "8px 12px",
                  }}
                  rows={2}
                  maxLength={2000}
                  aria-label="メッセージ入力"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "#7BA88A", color: "#fff" }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.background = "#5E8A6C"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7BA88A"; }}
                  aria-label="送信"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
              <div className="mt-1 text-xs" style={{ color: "#A69E93" }}>
                /help でコマンド一覧 · Enter で送信 · Shift+Enter で改行
              </div>
            </div>

            {/* リサイズハンドル */}
            <div
              onMouseDown={onResizeStart}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#A69E93" }}>
                <path d="M14 2L2 14M14 8L8 14M14 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB ボタン */}
      <AnimatePresence>
        {!open && showFab && !hideFab && (
          <motion.button
            key="chat-fab"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setOpen(true); setUnread(0); setPos((p) => clampPanelPos(p.x, p.y, size.w, size.h)); }}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-opacity duration-300 ${isScrolling ? "opacity-40" : "opacity-100"}`}
            style={{ background: "#7BA88A", color: "#fff" }}
            aria-label={`ラポルタ秘書を開く (${shortcutLabel})`}
            data-testid="assistant-chat-fab"
          >
            <Leaf className="h-6 w-6" aria-hidden="true" />
            {unread > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse"
                aria-label={`${unread}件の新着メッセージ`}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
