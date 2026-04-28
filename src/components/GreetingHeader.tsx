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
  /** 天気スタブ (将来 API 接続予定) */
  weather?: string;
}

export function GreetingHeader({
  userName = "光輝さん",
  now,
  weather = "晴れ",
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
      className="rounded-2xl px-6 py-5 shadow-sm"
    >
      <p
        className="font-bold text-brand-800"
        style={{ fontSize: "26px", lineHeight: 1.3, fontFamily: "var(--font-sans, sans-serif)" }}
      >
        {greeting}、{userName}
      </p>
      <p className="mt-1 text-sm text-brand-600">
        {dateStr} · {weather}
      </p>
    </motion.div>
  );
}
