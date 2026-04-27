import { describe, expect, it } from "vitest";
import { formatCurrency, getDefaultCurrency } from "../currency.js";

describe("formatCurrency", () => {
  it("formats JPY with no decimal places", () => {
    const result = formatCurrency(10000, "JPY", "ja-JP");
    expect(result).toContain("10,000");
    expect(result).not.toMatch(/\.\d/);
  });

  it("formats USD with 2 decimal places", () => {
    const result = formatCurrency(1234.5, "USD", "en-US");
    expect(result).toContain("1,234.50");
  });

  it("formats EUR with 2 decimal places", () => {
    const result = formatCurrency(1000, "EUR", "de-DE");
    expect(result).toContain("1.000,00");
  });

  it("formats GBP with 2 decimal places", () => {
    const result = formatCurrency(500, "GBP", "en-GB");
    expect(result).toContain("500.00");
    expect(result).toContain("£");
  });

  it("formats AUD with symbol", () => {
    const result = formatCurrency(250, "AUD", "en-AU");
    expect(result).toContain("250.00");
  });

  it("formats SGD with symbol", () => {
    const result = formatCurrency(100, "SGD", "en-SG");
    expect(result).toContain("100.00");
  });

  it("defaults to JPY when no currency specified", () => {
    const result = formatCurrency(5000, undefined, "ja-JP");
    expect(result).toContain("5,000");
    expect(result).not.toMatch(/\.\d/);
  });

  it("uses appropriate locale when locale omitted for JPY", () => {
    const result = formatCurrency(100000, "JPY");
    expect(result).toContain("100,000");
  });

  it("uses appropriate locale when locale omitted for USD", () => {
    const result = formatCurrency(1000, "USD");
    expect(result).toContain("1,000.00");
  });

  it("formats zero amount correctly for JPY", () => {
    const result = formatCurrency(0, "JPY", "ja-JP");
    expect(result).toContain("0");
    expect(result).not.toMatch(/\.\d/);
  });

  it("formats large JPY amount with thousands separator", () => {
    const result = formatCurrency(94600000, "JPY", "ja-JP");
    expect(result).toContain("94,600,000");
  });
});

describe("getDefaultCurrency", () => {
  it("returns JPY for ja locale", () => {
    expect(getDefaultCurrency("ja")).toBe("JPY");
  });

  it("returns JPY for ja-JP locale", () => {
    expect(getDefaultCurrency("ja-JP")).toBe("JPY");
  });

  it("returns USD for en-US locale", () => {
    expect(getDefaultCurrency("en-US")).toBe("USD");
  });

  it("returns GBP for en-GB locale", () => {
    expect(getDefaultCurrency("en-GB")).toBe("GBP");
  });

  it("returns AUD for en-AU locale", () => {
    expect(getDefaultCurrency("en-AU")).toBe("AUD");
  });

  it("returns EUR for de locale", () => {
    expect(getDefaultCurrency("de")).toBe("EUR");
  });

  it("returns EUR for fr locale", () => {
    expect(getDefaultCurrency("fr")).toBe("EUR");
  });

  it("returns USD for unknown en- locale", () => {
    expect(getDefaultCurrency("en-NZ")).toBe("USD");
  });

  it("returns USD as fallback for unknown locale", () => {
    expect(getDefaultCurrency("ko")).toBe("USD");
  });
});
