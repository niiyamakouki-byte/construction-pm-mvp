import { describe, expect, it } from "vitest";
import {
  convertLength,
  convertArea,
  formatLength,
  formatArea,
  getDefaultSystem,
} from "../units.js";

describe("convertLength", () => {
  it("mm to cm", () => {
    expect(convertLength(10, "mm", "cm")).toBeCloseTo(1, 5);
  });

  it("cm to m", () => {
    expect(convertLength(100, "cm", "m")).toBeCloseTo(1, 5);
  });

  it("m to mm", () => {
    expect(convertLength(1, "m", "mm")).toBeCloseTo(1000, 5);
  });

  it("in to mm exact (25.4mm per inch)", () => {
    expect(convertLength(1, "in", "mm")).toBeCloseTo(25.4, 8);
  });

  it("ft to m exact (0.3048m per foot)", () => {
    expect(convertLength(1, "ft", "m")).toBeCloseTo(0.3048, 8);
  });

  it("yd to m (0.9144m per yard)", () => {
    expect(convertLength(1, "yd", "m")).toBeCloseTo(0.9144, 8);
  });

  it("m to ft", () => {
    expect(convertLength(1, "m", "ft")).toBeCloseTo(3.28084, 4);
  });

  it("ft to in (12 inches per foot)", () => {
    expect(convertLength(1, "ft", "in")).toBeCloseTo(12, 8);
  });

  it("same unit returns same value", () => {
    expect(convertLength(5, "m", "m")).toBe(5);
  });

  it("1 yard equals 3 feet", () => {
    expect(convertLength(1, "yd", "ft")).toBeCloseTo(3, 8);
  });
});

describe("convertArea", () => {
  it("m2 to tsubo (1坪 = 3.305785 m²)", () => {
    expect(convertArea(3.305785, "m2", "tsubo")).toBeCloseTo(1, 4);
  });

  it("tsubo to m2", () => {
    expect(convertArea(1, "tsubo", "m2")).toBeCloseTo(3.305785, 4);
  });

  it("10坪 to m2", () => {
    expect(convertArea(10, "tsubo", "m2")).toBeCloseTo(33.05785, 3);
  });

  it("m2 to ft2", () => {
    // 1m² = 10.7639... ft²
    expect(convertArea(1, "m2", "ft2")).toBeCloseTo(10.7639, 3);
  });

  it("ft2 to m2", () => {
    expect(convertArea(10.7639, "ft2", "m2")).toBeCloseTo(1, 3);
  });

  it("tsubo to ft2", () => {
    // 1坪 = 3.305785 m² × 10.7639 ft²/m²
    const expected = 3.305785 * (1 / (0.3048 * 0.3048));
    expect(convertArea(1, "tsubo", "ft2")).toBeCloseTo(expected, 2);
  });

  it("same unit returns same value", () => {
    expect(convertArea(5, "m2", "m2")).toBe(5);
  });

  it("100 m2 to tsubo (30坪相当)", () => {
    expect(convertArea(100, "m2", "tsubo")).toBeCloseTo(30.25, 1);
  });
});

describe("formatLength", () => {
  it("formats meters in ja locale", () => {
    expect(formatLength(1.5, "m", "ja-JP")).toBe("1.5 m");
  });

  it("formats millimeters", () => {
    expect(formatLength(300, "mm", "en-US")).toBe("300 mm");
  });

  it("formats feet with apostrophe", () => {
    expect(formatLength(6, "ft", "en-US")).toBe("6'");
  });

  it("formats inches with double-quote", () => {
    expect(formatLength(12, "in", "en-US")).toBe(`12"`);
  });
});

describe("formatArea", () => {
  it("formats m2 with superscript", () => {
    expect(formatArea(50, "m2", "ja-JP")).toBe("50 m²");
  });

  it("formats tsubo with kanji", () => {
    expect(formatArea(20, "tsubo", "ja-JP")).toBe("20 坪");
  });

  it("formats ft2 with superscript", () => {
    expect(formatArea(100, "ft2", "en-US")).toBe("100 ft²");
  });
});

describe("getDefaultSystem", () => {
  it("returns jp for ja locale", () => {
    expect(getDefaultSystem("ja")).toBe("jp");
  });

  it("returns jp for ja-JP locale", () => {
    expect(getDefaultSystem("ja-JP")).toBe("jp");
  });

  it("returns imperial for en-US locale", () => {
    expect(getDefaultSystem("en-US")).toBe("imperial");
  });

  it("returns imperial for en-GB locale", () => {
    expect(getDefaultSystem("en-GB")).toBe("imperial");
  });

  it("returns metric for de locale", () => {
    expect(getDefaultSystem("de")).toBe("metric");
  });

  it("returns metric for fr locale", () => {
    expect(getDefaultSystem("fr")).toBe("metric");
  });
});
