export function formatDate(
  date: Date,
  locale: string,
  format: 'short' | 'medium' | 'long' = 'medium'
): string {
  const options: Intl.DateTimeFormatOptions = (() => {
    switch (format) {
      case 'short':
        return { year: 'numeric', month: '2-digit', day: '2-digit' } satisfies Intl.DateTimeFormatOptions;
      case 'medium':
        return { year: 'numeric', month: 'short', day: 'numeric' } satisfies Intl.DateTimeFormatOptions;
      case 'long':
        return { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } satisfies Intl.DateTimeFormatOptions;
    }
  })();
  return new Intl.DateTimeFormat(locale, options).format(date);
}

type DateTimeFormatWithRange = Intl.DateTimeFormat & {
  formatRange(start: Date, end: Date): string;
};

export function formatDateRange(start: Date, end: Date, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) as DateTimeFormatWithRange;
  // formatRange is available in Node 18+ / modern browsers
  if (typeof fmt.formatRange === 'function') {
    return fmt.formatRange(start, end);
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function formatRelativeTime(date: Date, locale: string): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);
  const diffMonths = Math.round(diffDays / 30);
  const diffYears = Math.round(diffDays / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, 'week');
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month');
  return rtf.format(diffYears, 'year');
}
