import { useEffect, useCallback } from "react";
import { navigate } from "./useHashRouter.js";

export type ShortcutAction =
  | "new-task"
  | "new-estimate"
  | "go-gantt"
  | "go-dashboard"
  | "close-modal"
  | "show-help";

export type ShortcutDef = {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  label: string;
  description: string;
};

export const SHORTCUT_DEFS: Record<ShortcutAction, ShortcutDef> = {
  "new-task": {
    key: "n",
    ctrlKey: true,
    label: "Ctrl+N",
    description: "新しいタスクを作成",
  },
  "new-estimate": {
    key: "e",
    ctrlKey: true,
    label: "Ctrl+E",
    description: "見積ページを開く",
  },
  "go-gantt": {
    key: "g",
    ctrlKey: true,
    label: "Ctrl+G",
    description: "ガントチャートへ移動",
  },
  "go-dashboard": {
    key: "d",
    ctrlKey: true,
    label: "Ctrl+D",
    description: "ダッシュボードへ移動",
  },
  "close-modal": {
    key: "Escape",
    label: "Escape",
    description: "モーダルを閉じる",
  },
  "show-help": {
    key: "?",
    label: "?",
    description: "ショートカット一覧を表示",
  },
};

export type KeyboardShortcutsOptions = {
  onNewTask?: () => void;
  onCloseModal?: () => void;
  onShowHelp?: () => void;
  disabled?: boolean;
};

export function useKeyboardShortcuts({
  onNewTask,
  onCloseModal,
  onShowHelp,
  disabled = false,
}: KeyboardShortcutsOptions = {}): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      // Ignore shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) {
        // Allow Escape even in inputs
        if (e.key !== "Escape") return;
      }

      // Ctrl+N — new task
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewTask?.();
        return;
      }

      // Ctrl+E — go to estimate
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        navigate("/estimate");
        return;
      }

      // Ctrl+G — go to Gantt
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        navigate("/gantt");
        return;
      }

      // Ctrl+D — go to Dashboard
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        navigate("/today");
        return;
      }

      // Escape — close modal
      if (e.key === "Escape") {
        onCloseModal?.();
        return;
      }

      // ? — show shortcut help
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === "?") {
        e.preventDefault();
        onShowHelp?.();
        return;
      }
    },
    [disabled, onNewTask, onCloseModal, onShowHelp],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
