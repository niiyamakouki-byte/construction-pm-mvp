import { motion } from "framer-motion";

/** 時間帯別挨拶を返す (JST = ローカル時刻前提) */
export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return "おはようございます";
  if (hour >= 11 && hour < 17) return "お疲れ様です";
  if (hour >= 17 && hour < 23) return "お疲れ様でした";
  return "夜遅くまでお疲れ様です";
}

const WEEKDAYS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"] as const;

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEKDAYS[date.getDay()];
  return `${y}年${m}月${d}日 ${w}`;
}

interface GreetingHeaderProps {
  userName?: string;
  /** テスト用: 現在時刻を上書き */
  now?: Date;
}

export function GreetingHeader({
  userName,
  now,
}: GreetingHeaderProps) {
  const date = now ?? new Date();
  const hour = date.getHours();
  const greeting = getGreeting(hour);
  const dateStr = formatDate(date);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: "linear-gradient(135deg, var(--app-bg, #F8F4ED), var(--app-card-muted, #F0EBE0))",
        border: "1px solid var(--app-border, #E5DDD0)",
      }}
      className="genba-flat-card min-w-[280px] rounded-2xl px-6 py-7 sm:px-8 sm:py-8"
    >
      {/* brand-700: brand-500 measured 3.17:1 against this card's light gradient bg, below WCAG AA (2026-07-28 contrast pass) */}
      <p className="eyebrow-label text-[11px] uppercase text-brand-700">今日の現場</p>
      <p
        className="hero-heading mt-1.5 text-brand-900"
        style={{
          fontSize: "clamp(24px, 6vw, 32px)",
          writingMode: "horizontal-tb",
          wordBreak: "keep-all",
        }}
      >
        {userName ? `${greeting}、${userName}` : greeting}
      </p>
      <p className="mt-2 text-sm text-brand-600" style={{ writingMode: "horizontal-tb", wordBreak: "keep-all" }}>
        {dateStr}
      </p>
    </motion.div>
  );
}
