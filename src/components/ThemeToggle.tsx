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
    label: "ライト",
    nextLabel: "ダーク",
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
  dark: {
    label: "ダーク",
    nextLabel: "自動",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M14.5 12.89A6.5 6.5 0 0 1 7.11 5.5 6.5 6.5 0 1 0 14.5 12.9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  system: {
    label: "自動",
    nextLabel: "ライト",
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
