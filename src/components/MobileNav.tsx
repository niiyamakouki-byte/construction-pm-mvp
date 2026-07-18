import { useEffect, useRef } from "react";
import { NavIcon } from "./NavIcons.js";

type MobileNavItem = {
  key: string;
  label: string;
  icon: string;
  path: string;
  active: boolean;
  dataTour?: string;
};

type MobileNavProps = {
  open: boolean;
  items: MobileNavItem[];
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (path: string) => void;
  personaLabel: string;
  onTogglePersona: () => void;
  userLabel?: string;
  onSignOut?: () => void;
};

export function MobileNav({
  open,
  items,
  onOpen,
  onClose,
  onNavigate,
  personaLabel,
  onTogglePersona,
  userLabel,
  onSignOut,
}: MobileNavProps) {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    // Swipe right >= 60px to close (drawer is on the right side)
    if (dx > 60) onClose();
  };

  const handleNavigate = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="メニューを開く"
        aria-expanded={open}
        aria-controls="mobile-navigation-drawer"
        className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/70 px-3 text-slate-600 hover:bg-white backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-xs font-semibold leading-none">メニュー</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="メニューの背景"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <aside
            id="mobile-navigation-drawer"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,86vw)] flex-col border-l border-[rgba(60,60,67,0.12)] bg-white/92 backdrop-blur-xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="モバイルナビゲーション"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">
                  <span className="font-bold">Lapo</span><span className="font-normal">Site</span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">メニュー</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="メニューを閉じる"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="モバイルメニュー項目">
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    data-tour={item.dataTour}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                      item.active
                        ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                        : "text-slate-600 hover:bg-[#007AFF]/5"
                    }`}
                  >
                    <span className="flex shrink-0 items-center justify-center" aria-hidden="true">
                      <NavIcon id={item.icon} />
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="space-y-2 border-t border-slate-200 px-3 py-4">
              <button
                type="button"
                onClick={() => {
                  onTogglePersona();
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                <span>表示モード</span>
                <span>{personaLabel}</span>
              </button>
              {userLabel && onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  title={userLabel}
                >
                  <span>サインアウト</span>
                  <span className="truncate text-right text-xs text-slate-400">{userLabel}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
