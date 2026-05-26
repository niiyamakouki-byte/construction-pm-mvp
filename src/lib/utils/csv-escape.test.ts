import { describe, expect, it } from "vitest";
import { csvEscape } from "./csv-escape.js";

describe("csvEscape", () => {
  it("passes through a plain string unchanged", () => {
    expect(csvEscape("塗装")).toBe("塗装");
  });

  it("passes through a plain number as string", () => {
    expect(csvEscape(12345)).toBe("12345");
  });

  it("wraps a value containing a comma in double-quotes", () => {
    expect(csvEscape("工事A,工事B")).toBe('"工事A,工事B"');
  });

  it("escapes embedded double-quotes by doubling", () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps a value containing a newline in double-quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  // ── Formula injection guard ─────────────────────────────────────────────
  it("guards a value starting with = (formula injection)", () => {
    const result = csvEscape("=SUM(A1:A10)");
    expect(result).toContain("'=SUM(A1:A10)");
    // must be wrapped in quotes so the leading ' is literal
    expect(result).toBe("\"'=SUM(A1:A10)\"");
  });

  it("guards a value starting with + (formula injection)", () => {
    const result = csvEscape("+cmd|'/c calc'!A1");
    expect(result).toContain("'+");
  });

  it("guards a value starting with - (formula injection)", () => {
    const result = csvEscape("-1+2");
    expect(result).toBe("\"'-1+2\"");
  });

  it("guards a value starting with @ (formula injection)", () => {
    const result = csvEscape("@SUM(1,2)");
    expect(result).toContain("'@SUM");
  });

  it("guards a value starting with tab character", () => {
    const result = csvEscape("\tdata");
    expect(result).toContain("'\t");
  });

  it("does NOT guard a value starting with a normal character", () => {
    // Values that start with letters or digits are safe
    expect(csvEscape("abc")).toBe("abc");
    expect(csvEscape("123")).toBe("123");
    expect(csvEscape("業者A")).toBe("業者A");
  });

  it("a number that looks like a formula when stringified is safe (numbers start with digit)", () => {
    // Number 123 -> "123", starts with digit, no guard needed
    expect(csvEscape(123)).toBe("123");
  });

  it("empty string is passed through unchanged", () => {
    expect(csvEscape("")).toBe("");
  });
});
