import { describe, expect, it, vi, afterEach } from "vitest";
import { formatDate, formatDateRange, formatRelativeTime } from "../date.js";

describe("formatDate", () => {
  const sampleDate = new Date("2025-04-15T12:00:00Z");

  it("formats date in ja locale short format", () => {
    const result = formatDate(sampleDate, "ja-JP", "short");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/04|4/);
    expect(result).toMatch(/15/);
  });

  it("formats date in ja locale medium format", () => {
    const result = formatDate(sampleDate, "ja-JP", "medium");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/4月/);
  });

  it("formats date in ja locale long format includes weekday", () => {
    const result = formatDate(sampleDate, "ja-JP", "long");
    expect(result).toMatch(/2025/);
    // weekday should be present
    expect(result.length).toBeGreaterThan(10);
  });

  it("formats date in en-US locale medium format", () => {
    const result = formatDate(sampleDate, "en-US", "medium");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/15/);
  });

  it("formats date in en-US locale short format", () => {
    const result = formatDate(sampleDate, "en-US", "short");
    expect(result).toMatch(/2025/);
  });

  it("formats date in de locale", () => {
    const result = formatDate(sampleDate, "de-DE", "medium");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/Apr/);
  });

  it("defaults to medium format when no format specified", () => {
    const result = formatDate(sampleDate, "en-US");
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/2025/);
  });

  it("formats date in long format for en-US with weekday", () => {
    const result = formatDate(sampleDate, "en-US", "long");
    expect(result).toMatch(/Tuesday/);
    expect(result).toMatch(/April/);
    expect(result).toMatch(/2025/);
  });
});

describe("formatDateRange", () => {
  it("formats a date range in ja locale", () => {
    const start = new Date("2025-04-01");
    const end = new Date("2025-04-30");
    const result = formatDateRange(start, end, "ja-JP");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/4/);
  });

  it("formats a date range in en-US locale", () => {
    const start = new Date("2025-04-01");
    const end = new Date("2025-04-30");
    const result = formatDateRange(start, end, "en-US");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/Apr/);
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'now' or equivalent for very recent time in ja", () => {
    vi.useFakeTimers();
    const now = new Date("2025-04-15T12:00:00Z");
    vi.setSystemTime(now);
    const result = formatRelativeTime(new Date("2025-04-15T11:59:55Z"), "ja-JP");
    // "5秒前" or similar
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns days ago in ja locale", () => {
    vi.useFakeTimers();
    const now = new Date("2025-04-15T12:00:00Z");
    vi.setSystemTime(now);
    const twoDaysAgo = new Date("2025-04-13T12:00:00Z");
    const result = formatRelativeTime(twoDaysAgo, "ja-JP");
    // Intl.RelativeTimeFormat with numeric:'auto' returns '一昨日' for -2 days in ja
    expect(result).toMatch(/日/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns days ago in en-US locale", () => {
    vi.useFakeTimers();
    const now = new Date("2025-04-15T12:00:00Z");
    vi.setSystemTime(now);
    const twoDaysAgo = new Date("2025-04-13T12:00:00Z");
    const result = formatRelativeTime(twoDaysAgo, "en-US");
    expect(result).toMatch(/2 days ago/);
  });

  it("returns future relative time in en-US", () => {
    vi.useFakeTimers();
    const now = new Date("2025-04-15T12:00:00Z");
    vi.setSystemTime(now);
    const tomorrow = new Date("2025-04-16T12:00:00Z");
    const result = formatRelativeTime(tomorrow, "en-US");
    expect(result).toMatch(/tomorrow|1 day/);
  });

  it("returns months ago in ja locale", () => {
    vi.useFakeTimers();
    const now = new Date("2025-04-15T12:00:00Z");
    vi.setSystemTime(now);
    const threeMonthsAgo = new Date("2025-01-15T12:00:00Z");
    const result = formatRelativeTime(threeMonthsAgo, "ja-JP");
    expect(result).toMatch(/3/);
    expect(result).toMatch(/ヶ月|か月|カ月/);
  });
});
