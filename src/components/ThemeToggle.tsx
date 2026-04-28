import type { ReactNode } from "react";
import type { ThemePreference } from "../hooks/useTheme.js";

type ThemeToggleProps = {
  theme: ThemePreference;
  onToggle: () => void;
  className?: string;
};

const THEME_META: Record<
  ThemePreference,
  {
    label: string;
    nextLabel: string;
    icon: ReactNode;
  }
> = {
  light: {
    label: "日中モード",
    nextLabel: "夕方モード",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="10" cy="10" r="3.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 1.75v2.1M10 16.15v2.1M4.17 4.17l1.48 1.48M14.35 14.35l1.48 1.48M1.75 10h2.1M16.15 10h2.1M4.17 15.83l1.48-1.48M14.35 5.65l1.48-1.48"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  evening: {
    label: "夕方モード",
    nextLabel: "自動",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        {/* ローソク: 炎 + 本体 */}
        <rect x="8.5" y="10" width="3" height="7" rx="1" fill="currentColor" opacity="0.5" />
        <ellipse cx="10" cy="10" rx="1.5" ry="1" fill="currentColor" opacity="0.3" />
        <path
          d="M10 9c0 0 1.5-2 1.5-3.5a1.5 1.5 0 0 0-3 0C8.5 7 10 9 10 9Z"
          fill="currentColor"
          opacity="0.85"
        />
        <path
          d="M10 8.5c0 0 .8-1 .8-2a.8.8 0 0 0-1.6 0C9.2 7.5 10 8.5 10 8.5Z"
          fill="#D4A35C"
        />
      </svg>
    ),
  },
  system: {
    label: "自動",
    nextLabel: "日中モード",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="2.5" y="3" width="15" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 16.5h6M10 13.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function ThemeToggle({ theme, onToggle, className = "" }: ThemeToggleProps) {
  const meta = THEME_META[theme];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`テーマ: ${meta.label}. 次は${meta.nextLabel}`}
      title={`テーマ: ${meta.label}`}
      className={`flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 ${className}`.trim()}
    >
      {meta.icon}
      <span className="hidden sm:inline">{meta.label}</span>
    </button>
  );
}
