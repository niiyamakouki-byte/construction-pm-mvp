import { useState } from "react";

export type AiAction = {
  id: string;
  /** "info" = 青, "warning" = 黄, "urgent" = 赤 */
  severity: "info" | "warning" | "urgent";
  message: string;
  actionLabel: string;
  onAction: () => void | Promise<void>;
};

type Props = {
  actions: AiAction[];
};

const severityStyles = {
  info: {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  warning: {
    container: "border-amber-200 bg-amber-50",
    icon: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
    button: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  urgent: {
    container: "border-red-200 bg-red-50",
    icon: "text-red-500",
    badge: "bg-red-100 text-red-700",
    button: "bg-red-600 hover:bg-red-700 text-white",
  },
} as const;

function CardIcon({ severity }: { severity: AiAction["severity"] }) {
  if (severity === "urgent") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

export function AiActionCard({ actions }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<Set<string>>(new Set());

  const visible = actions.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const handleAction = async (action: AiAction) => {
    setActing((prev) => new Set(prev).add(action.id));
    try {
      await action.onAction();
    } finally {
      setActing((prev) => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
      setDismissed((prev) => new Set(prev).add(action.id));
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="mb-3 flex flex-col gap-2">
      {visible.map((action) => {
        const styles = severityStyles[action.severity];
        const isActing = acting.has(action.id);
        return (
          <div
            key={action.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${styles.container}`}
            role="alert"
          >
            <span className={`mt-0.5 ${styles.icon}`}>
              <CardIcon severity={action.severity} />
            </span>
            <p className="flex-1 text-sm text-slate-800">{action.message}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isActing}
                onClick={() => { void handleAction(action); }}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${styles.button}`}
              >
                {isActing ? "処理中..." : action.actionLabel}
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(action.id)}
                aria-label="閉じる"
                className="rounded p-0.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
