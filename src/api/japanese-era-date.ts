type EraDefinition = {
  aliases: string[];
  start: readonly [number, number, number];
  end?: readonly [number, number, number];
};

const JAPANESE_ERAS: EraDefinition[] = [
  {
    aliases: ["令和", "r"],
    start: [2019, 5, 1],
  },
  {
    aliases: ["平成", "h"],
    start: [1989, 1, 8],
    end: [2019, 4, 30],
  },
  {
    aliases: ["昭和", "s"],
    start: [1926, 12, 25],
    end: [1989, 1, 7],
  },
  {
    aliases: ["大正", "t"],
    start: [1912, 7, 30],
    end: [1926, 12, 24],
  },
  {
    aliases: ["明治", "m"],
    start: [1868, 1, 25],
    end: [1912, 7, 29],
  },
];

export function parseJapaneseEraDate(value: string): { year: number; month: number; day: number } | null {
  for (const era of JAPANESE_ERAS) {
    const [kanjiAlias, latinAlias] = era.aliases;
    const match =
      value.match(
        new RegExp(`^${kanjiAlias}\\s*(元|\\d{1,2})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日$`, "i"),
      ) ??
      value.match(
        new RegExp(`^${latinAlias}\\s*(元|gannen|\\d{1,2})[./-](\\d{1,2})[./-](\\d{1,2})$`, "i"),
      );
    if (!match) {
      continue;
    }

    const yearToken = match[1].toLowerCase();
    const eraYear = yearToken === "元" || yearToken === "gannen" ? 1 : Number(yearToken);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const year = era.start[0] + eraYear - 1;

    assertEraDateInRange(era, year, month, day);
    return { year, month, day };
  }

  return null;
}

function assertEraDateInRange(
  era: EraDefinition,
  year: number,
  month: number,
  day: number,
): void {
  const candidate = year * 10_000 + month * 100 + day;
  const start = era.start[0] * 10_000 + era.start[1] * 100 + era.start[2];
  const end = era.end
    ? era.end[0] * 10_000 + era.end[1] * 100 + era.end[2]
    : Number.POSITIVE_INFINITY;

  if (candidate < start || candidate > end) {
    throw new Error("日付が不正です。");
  }
}
