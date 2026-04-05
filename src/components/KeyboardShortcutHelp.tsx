import { useEffect } from "react";
import { SHORTCUT_DEFS, ShortcutAction } from "../hooks/useKeyboardShortcuts.js";

type Props = {
  onClose: () => void;
};

const SHORTCUT_ORDER: ShortcutAction[] = [
  "go-dashboard",
  "go-gantt",
  "new-task",
  "new-estimate",
  "show-help",
  "close-modal",
];

export function KeyboardShortcutHelp({ onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="キーボードショートカット一覧"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            キーボードショートカット
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {SHORTCUT_ORDER.map((action) => {
            const def = SHORTCUT_DEFS[action];
            return (
              <li
                key={action}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm text-slate-700">{def.description}</span>
                <kbd className="ml-4 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 shadow-sm">
                  {def.label}
                </kbd>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">
            入力フィールド内ではCtrl系ショートカットは無効化されます
          </p>
        </div>
      </div>
    </div>
  );
}
