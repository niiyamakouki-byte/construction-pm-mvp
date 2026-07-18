import type { ReactNode } from "react";
import { motion } from "framer-motion";

type AccentType = "primary" | "warm" | "warning" | "success";

const accentStyles: Record<AccentType, { icon: string; badge: string }> = {
  primary: {
    icon: "bg-slate-100 text-slate-500",
    badge: "bg-brand-50 text-brand-700 border-brand-200",
  },
  warm: {
    icon: "bg-slate-100 text-slate-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  warning: {
    icon: "bg-slate-100 text-slate-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  success: {
    icon: "bg-brand-50 text-brand-600",
    badge: "bg-brand-50 text-brand-700 border-brand-200",
  },
};

interface DashboardCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon?: ReactNode;
  accent?: AccentType;
  onClick?: () => void;
  /** 値がゼロなど強調不要の場合 true にすると数値を控えめトーンで表示 */
  muted?: boolean;
}

export function DashboardCard({
  title,
  value,
  subtext,
  icon,
  accent = "primary",
  onClick,
  muted = false,
}: DashboardCardProps) {
  const styles = accentStyles[accent];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="w-full rounded-[20px] bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:p-6"
      style={{ border: "1px solid var(--app-border, #E5DDD0)" }}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-brand-600 sm:tracking-widest">
            {title}
          </p>
          <p className={`mt-1 text-xl font-bold sm:text-2xl ${muted ? "text-slate-400" : "text-brand-900"}`}>
            {value}
          </p>
          {subtext && (
            <p className="mt-1 truncate text-xs text-brand-500">{subtext}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
