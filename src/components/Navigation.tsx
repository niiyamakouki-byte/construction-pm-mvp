import { useState } from "react";

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  path: string;
  active: boolean;
};

type NavigationProps = {
  items: NavItem[];
  onNavigate: (path: string) => void;
};

/**
 * 中央ナビゲーションメニュー
 * デスクトップ: 縦サイドバー風ドロップダウン
 * モバイル: ハンバーガーメニュー → オーバーレイドロワー
 */
export function Navigation({ items, onNavigate }: NavigationProps) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setOpen(false);
  };

  return (
    <div data-testid="navigation">
      {/* ハンバーガーボタン */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "ナビゲーションを閉じる" : "ナビゲーションを開く"}
        aria-expanded={open}
        aria-controls="central-nav-menu"
        className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
        <span className="hidden sm:inline">メニュー</span>
      </button>

      {/* オーバーレイ */}
      {open && (
        <button
          type="button"
          aria-label="ナビゲーションを閉じる"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30"
        />
      )}

      {/* ドロワー */}
      <div
        id="central-nav-menu"
        role="navigation"
        aria-label="中央ナビゲーション"
        className={`absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white/90 py-2 shadow-xl backdrop-blur-md transition-all duration-150 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleNavigate(item.path)}
            aria-current={item.active ? "page" : undefined}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              item.active
                ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                : "text-slate-600 hover:bg-[#007AFF]/5"
            }`}
          >
            <span className="text-base" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
