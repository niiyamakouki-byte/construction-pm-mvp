import { describe, it, expect } from "vitest";
import { discordEstimate, formatEstimateForDiscord } from "../estimate/discord-estimate";
import { parseNaturalLanguage } from "../estimate/nl-estimate-parser";
import { generateEstimate } from "../estimate/estimate-generator";

describe("discordEstimate", () => {
  it("6畳の壁紙張替え → Markdownテーブルを生成", () => {
    const result = discordEstimate("6畳の壁紙張替え");

    // メッセージが存在する
    expect(result.message).toBeTruthy();
    expect(result.estimate).toBeTruthy();

    // ヘッダーに入力テキストが含まれる
    expect(result.message).toContain("6畳の壁紙張替え");

    // Markdownテーブルのヘッダーがある
    expect(result.message).toContain("| 品目 | 数量 | 単価 | 金額 |");

    // 壁紙関連の品目が含まれている
    expect(result.message).toContain("クロス");

    // 税込合計が含まれている
    expect(result.message).toContain("税込合計");

    // 金額が0でない
    expect(result.estimate.total).toBeGreaterThan(0);
  });

  it("複数品目: タイルカーペットとLED照明", () => {
    const result = discordEstimate("20㎡のタイルカーペット張替え、LED照明10台");

    expect(result.estimate.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.message).toContain("タイルカーペット");
    expect(result.message).toContain("LED");
    expect(result.estimate.total).toBeGreaterThan(0);
  });

  it("マッチなしの場合はエラーメッセージ", () => {
    const result = discordEstimate("こんにちは");

    expect(result.message).toContain("工事内容を特定できませんでした");
    expect(result.parseResult.items).toHaveLength(0);
  });

  it("未マッチフレーズがあれば警告を表示", () => {
    const result = discordEstimate("6畳の壁紙張替え、謎の工事");

    // 壁紙は拾える
    expect(result.estimate.total).toBeGreaterThan(0);
    // 「謎の工事」は未マッチ警告
    expect(result.message).toContain("未対応");
  });

  it("面積検出のサマリーが含まれる", () => {
    const result = discordEstimate("6畳の壁紙張替え");
    // 6畳 = 9.7㎡
    expect(result.message).toContain("6畳");
    expect(result.message).toContain("9.7m");
  });

  it("フッターにラポルタが含まれる", () => {
    const result = discordEstimate("エアコン1台");
    expect(result.message).toContain("ラポルタ");
  });

  it("propertyNameを指定できる", () => {
    const result = discordEstimate("6畳の壁紙張替え", "テスト物件A");
    expect(result.estimate.propertyName).toBe("テスト物件A");
  });
});

describe("formatEstimateForDiscord", () => {
  it("Estimateオブジェクトから直接フォーマットできる", () => {
    const parseResult = parseNaturalLanguage("8畳のフローリング張替え");
    const items = parseResult.items.map(({ code, quantity }) => ({ code, quantity }));
    const estimate = generateEstimate({
      propertyName: "テスト物件",
      clientName: "テスト",
      items,
    });

    const message = formatEstimateForDiscord(estimate, parseResult);

    expect(message).toContain("| 品目 | 数量 | 単価 | 金額 |");
    expect(message).toContain("フローリング");
    expect(message).toContain("税込合計");
  });
});
