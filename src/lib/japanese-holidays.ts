const BASE_HOLIDAYS_2025_2027: Record<string, string> = {
  "2025-01-01": "元日",
  "2025-01-13": "成人の日",
  "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日",
  "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日",
  "2025-05-03": "憲法記念日",
  "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日",
  "2025-07-21": "海の日",
  "2025-08-11": "山の日",
  "2025-09-15": "敬老の日",
  "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日",
  "2025-11-03": "文化の日",
  "2025-11-23": "勤労感謝の日",
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日",
};

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: string, days: number): string {
  const next = toDate(date);
  next.setDate(next.getDate() + days);
  return toLocalDateString(next);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = toDate(startDate);
  const end = toDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function buildHolidayMaster(): Record<string, string> {
  const holidays = new Map<string, string>(Object.entries(BASE_HOLIDAYS_2025_2027));
  const sortedDates = [...holidays.keys()].sort();

  for (let index = 0; index < sortedDates.length - 1; index += 1) {
    const currentDate = sortedDates[index];
    const nextDate = sortedDates[index + 1];
    if (daysBetween(currentDate, nextDate) !== 2) continue;

    const inBetweenDate = addDays(currentDate, 1);
    if (!holidays.has(inBetweenDate)) {
      holidays.set(inBetweenDate, "国民の休日");
    }
  }

  for (const [date] of [...holidays.entries()]) {
    if (toDate(date).getDay() !== 0) continue;

    let substituteDate = addDays(date, 1);
    while (holidays.has(substituteDate)) {
      substituteDate = addDays(substituteDate, 1);
    }
    holidays.set(substituteDate, "振替休日");
  }

  return Object.freeze(
    Object.fromEntries([...holidays.entries()].sort(([left], [right]) => left.localeCompare(right))),
  );
}

export const JAPANESE_HOLIDAYS_2025_2027 = buildHolidayMaster();

export function isHoliday(date: string): boolean {
  return date in JAPANESE_HOLIDAYS_2025_2027;
}

export function getHolidayName(date: string): string | null {
  return JAPANESE_HOLIDAYS_2025_2027[date] ?? null;
}
