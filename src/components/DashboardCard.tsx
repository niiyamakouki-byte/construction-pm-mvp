import { motion } from "framer-motion";

type AccentType = "primary" | "warm" | "warning" | "success";

const accentStyles: Record<AccentType, { icon: string; badge: string }> = {
  primary: {
    icon: "bg-brand-100 text-brand-700",
    badge: "bg-brand-50 text-brand-700 border-brand-200",
  },
  warm: {
    icon: "bg-orange-100 text-orange-700",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  warning: {
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  success: {
    icon: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

interface DashboardCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon?: string;
  accent?: AccentType;
  onClick?: () => void;
}

export function DashboardCard({
  title,
  value,
  subtext,
  icon,
  accent = "primary",
  onClick,
}: DashboardCardProps) {
  const styles = accentStyles[accent];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="w-full rounded-[20px] bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--app-border, #E5DDD0)" }}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${styles.icon}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-900">{value}</p>
          {subtext && (
            <p className="mt-1 truncate text-xs text-brand-500">{subtext}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
