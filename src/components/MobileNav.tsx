import { useEffect } from "react";

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
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-[80] transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={open ? undefined : "true"}
      >
        <button
          type="button"
          aria-label="メニューの背景"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        />

        <aside
          id="mobile-navigation-drawer"
          className={`absolute inset-y-0 right-0 flex w-[min(22rem,86vw)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="モバイルナビゲーション"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">
                GenbaHub
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
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                    item.active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">
                    {item.icon}
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
    </div>
  );
}
