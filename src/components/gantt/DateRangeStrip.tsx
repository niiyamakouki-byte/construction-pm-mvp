import { addDays, daysBetween, formatDayNumber, formatWeekdayLabel } from "./utils.js";
import { isHoliday } from "../../lib/japanese-holidays.js";

type Props = {
  startDate: string;
  endDate: string;
  today: string;
};

/**
 * COMPASS流「範囲塗り」: 開始/終了の date input だけでは期間の実感が薄いため、
 * 選択中の日付範囲を横並びの日セルで塗って見せる（票p37edd075）。
 * 日付編集そのものは既存の input[type=date] が担い、本コンポーネントは
 * 選択結果の視覚フィードバックに徹する（新規カレンダーpickerは作らない）。
 */
export function DateRangeStrip({ startDate, endDate, today }: Props) {
  if (!startDate || !endDate || endDate < startDate) return null;

  const PAD_DAYS = 2;
  const rangeStart = addDays(startDate, -PAD_DAYS);
  const spanDays = daysBetween(rangeStart, endDate) + 1 + PAD_DAYS;
  const days = Array.from({ length: spanDays }, (_, i) => addDays(rangeStart, i));

  return (
    <div
      data-testid="date-range-strip"
      className="flex gap-0.5 overflow-x-auto rounded-2xl bg-slate-50 p-2"
      aria-label="選択中の期間"
    >
      {days.map((date) => {
        const inRange = date >= startDate && date <= endDate;
        const isToday = date === today;
        const dow = new Date(`${date}T00:00:00`).getDay();
        const isRestDay = dow === 0 || dow === 6 || isHoliday(date);
        return (
          <div
            key={date}
            data-testid={inRange ? "range-cell-painted" : "range-cell"}
            className={`flex w-8 shrink-0 flex-col items-center rounded-lg py-1 text-[10px] ${
              inRange ? "bg-brand-100 text-brand-700 font-semibold" : "text-slate-400"
            } ${isToday ? "ring-2 ring-brand-500" : ""}`}
          >
            <span className={isRestDay && !inRange ? "text-red-400" : undefined}>
              {formatWeekdayLabel(date)}
            </span>
            <span>{formatDayNumber(date)}</span>
          </div>
        );
      })}
    </div>
  );
}
