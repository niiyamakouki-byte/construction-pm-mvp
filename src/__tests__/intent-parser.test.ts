/**
 * intent-parser テスト — 自然言語インテント抽出 (Sprint 9-A)
 */
import { describe, it, expect } from "vitest";
import { parseIntent, convertToSqM } from "../lib/estimate-assistant/intent-parser.js";

// ── 部屋種類 ─────────────────────────────────────────────────────────────────

describe("parseIntent — roomType", () => {
  it("LDKを正しく認識する", () => {
    expect(parseIntent("LDKのリフォームをお願いしたい").roomType).toBe("LDK");
  });

  it("リビングからLDKを認識する", () => {
    expect(parseIntent("リビングの壁紙を張り替えたい").roomType).toBe("LDK");
  });

  it("和室を認識する", () => {
    expect(parseIntent("和室を洋室に変えたい").roomType).toBe("和室");
  });

  it("寝室を認識する", () => {
    expect(parseIntent("寝室のクロスが汚れた").roomType).toBe("寝室");
  });

  it("水回りをキッチンから認識する", () => {
    expect(parseIntent("キッチンをリフォームしたい").roomType).toBe("水回り");
  });

  it("外壁を認識する", () => {
    expect(parseIntent("外壁の塗装が剥がれてきた").roomType).toBe("外壁");
  });

  it("屋根を認識する", () => {
    expect(parseIntent("屋根の防水が心配です").roomType).toBe("屋根");
  });

  it("部屋種類が不明な場合はundefined", () => {
    expect(parseIntent("見積もりをお願いします").roomType).toBeUndefined();
  });
});

// ── 面積 ─────────────────────────────────────────────────────────────────────

describe("parseIntent — area", () => {
  it("畳の面積を認識する", () => {
    const result = parseIntent("20畳のLDKをリフォームしたい");
    expect(result.area).toEqual({ value: 20, unit: "畳" });
  });

  it("㎡の面積を認識する", () => {
    const result = parseIntent("30㎡の部屋の床を張り替えたい");
    expect(result.area).toEqual({ value: 30, unit: "㎡" });
  });

  it("平米表記を認識する", () => {
    const result = parseIntent("25平米のリビングを改装");
    expect(result.area).toEqual({ value: 25, unit: "㎡" });
  });

  it("坪を認識する", () => {
    const result = parseIntent("10坪の部屋のリフォーム");
    expect(result.area).toEqual({ value: 10, unit: "坪" });
  });

  it("小数点を含む面積を認識する", () => {
    const result = parseIntent("12.5畳のお部屋");
    expect(result.area).toEqual({ value: 12.5, unit: "畳" });
  });

  it("面積がない場合はundefined", () => {
    expect(parseIntent("リビングのリフォームをお願い").area).toBeUndefined();
  });
});

// ── グレード ─────────────────────────────────────────────────────────────────

describe("parseIntent — grade", () => {
  it("松→highを認識する", () => {
    expect(parseIntent("松コースでお願いします").grade).toBe("high");
  });

  it("ハイグレードを認識する", () => {
    expect(parseIntent("ハイグレードで仕上げたい").grade).toBe("high");
  });

  it("プレミアムを認識する", () => {
    expect(parseIntent("プレミアムな素材で").grade).toBe("high");
  });

  it("竹→midを認識する", () => {
    expect(parseIntent("竹コースでお願いします").grade).toBe("mid");
  });

  it("標準を認識する", () => {
    expect(parseIntent("標準的な仕上げで").grade).toBe("mid");
  });

  it("おまかせを認識する", () => {
    expect(parseIntent("おまかせします").grade).toBe("mid");
  });

  it("梅→lowを認識する", () => {
    expect(parseIntent("梅プランで").grade).toBe("low");
  });

  it("エコノミーを認識する", () => {
    expect(parseIntent("エコノミーで十分です").grade).toBe("low");
  });

  it("できるだけ安くを認識する", () => {
    expect(parseIntent("できるだけ安くしたい").grade).toBe("low");
  });

  it("グレード不明はundefined", () => {
    expect(parseIntent("リビングのリフォーム").grade).toBeUndefined();
  });
});

// ── 工種 ─────────────────────────────────────────────────────────────────────

describe("parseIntent — tasks", () => {
  it("塗装を認識する", () => {
    expect(parseIntent("外壁の塗装をお願いします").tasks).toContain("塗装");
  });

  it("クロス張替を認識する", () => {
    expect(parseIntent("壁紙の張替えをしたい").tasks).toContain("クロス張替");
  });

  it("解体を認識する", () => {
    expect(parseIntent("間仕切りを解体したい").tasks).toContain("解体");
  });

  it("リノベーションを認識する", () => {
    expect(parseIntent("フルリノベーションをお願いします").tasks).toContain("リノベーション");
  });

  it("複数工種を同時認識する", () => {
    const result = parseIntent("床と壁紙を張替えて、電気工事もお願い");
    expect(result.tasks).toContain("床工事");
    expect(result.tasks).toContain("クロス張替");
    expect(result.tasks).toContain("電気工事");
  });

  it("工種なし→空配列", () => {
    expect(parseIntent("見積もりを教えてください").tasks).toHaveLength(0);
  });
});

// ── 混在入力 ─────────────────────────────────────────────────────────────────

describe("parseIntent — 混在・複合", () => {
  it("部屋・面積・グレード・工種を同時に抽出する", () => {
    const result = parseIntent("LDK 20畳の壁紙張替え、標準グレードで");
    expect(result.roomType).toBe("LDK");
    expect(result.area).toEqual({ value: 20, unit: "畳" });
    expect(result.grade).toBe("mid");
    expect(result.tasks).toContain("クロス張替");
  });

  it("rawTextに元のメッセージが保持される", () => {
    const msg = "和室 8畳の畳替えをお願い";
    expect(parseIntent(msg).rawText).toBe(msg);
  });

  it("曖昧入力でもエラーにならない", () => {
    expect(() => parseIntent("なんかいい感じにしたい")).not.toThrow();
  });
});

// ── 面積換算 ─────────────────────────────────────────────────────────────────

describe("convertToSqM", () => {
  it("㎡はそのまま返す", () => {
    expect(convertToSqM(30, "㎡")).toBe(30);
  });

  it("畳を㎡に換算する (1畳=1.62㎡)", () => {
    expect(convertToSqM(10, "畳")).toBe(16.2);
  });

  it("坪を㎡に換算する (1坪≒3.30㎡)", () => {
    expect(convertToSqM(3, "坪")).toBeCloseTo(9.92, 1);
  });
});
