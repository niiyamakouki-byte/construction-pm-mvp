import { describe, it, expect } from "vitest";
import { discordEstimate, formatEstimateForDiscord, handleDiscordEstimateMessage, isEstimateRequest } from "../estimate/discord-estimate";
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
    expect(result.estimate!.total).toBeGreaterThan(0);
  });

  it("複数品目: タイルカーペットとLED照明", () => {
    const result = discordEstimate("20㎡のタイルカーペット張替え、LED照明10台");

    expect(result.estimate!.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.message).toContain("タイルカーペット");
    expect(result.message).toContain("LED");
    expect(result.estimate!.total).toBeGreaterThan(0);
  });

  it("マッチなしの場合はエラーメッセージ", () => {
    const result = discordEstimate("こんにちは");

    expect(result.message).toContain("工事内容を特定できませんでした");
    expect(result.parseResult.items).toHaveLength(0);
  });

  it("未マッチフレーズがあれば警告を表示", () => {
    const result = discordEstimate("6畳の壁紙張替え、謎の工事");

    // 壁紙は拾える
    expect(result.estimate!.total).toBeGreaterThan(0);
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
    expect(result.estimate!.propertyName).toBe("テスト物件A");
  });
});

describe("discordEstimate realistic scenarios", () => {
  it("20坪のオフィスリノベーション → professional output with 5 items", () => {
    const result = discordEstimate(
      "20坪のオフィスのリノベーション、壁はクロス張替え、床はタイルカーペット、天井は岩綿吸音板、LED照明20台、エアコン3台",
    );

    expect(result.estimate!.total).toBeGreaterThan(1_000_000);
    expect(result.estimate!.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.message).toContain("クロス");
    expect(result.message).toContain("タイルカーペット");
    expect(result.message).toContain("システム天井");
    expect(result.message).toContain("LED");
    expect(result.message).toContain("エアコン");
    // No false unmatched warnings
    expect(result.parseResult.unmatched).toHaveLength(0);
  });

  it("間仕切り5m×2.4m両面PB+クロス → correct dimensions", () => {
    const result = discordEstimate("間仕切りLGS壁新設5m×2.4m、両面PB+クロス");

    expect(result.message).toContain("LGS間仕切り");
    expect(result.message).toContain("クロス");
    // 間仕切り12㎡, クロス24㎡(両面)
    expect(result.message).toContain("12㎡");
    expect(result.message).toContain("24㎡");
    expect(result.estimate!.total).toBeGreaterThan(0);
  });

  it("6畳の洋室、壁紙張替えとフローリング → clean output", () => {
    const result = discordEstimate("6畳の洋室、壁紙張替えとフローリング");

    expect(result.message).toContain("クロス");
    expect(result.message).toContain("フローリング");
    expect(result.parseResult.unmatched).toHaveLength(0);
    expect(result.estimate!.total).toBeGreaterThan(100_000);
  });

  it("店舗の内装解体50㎡ → demolition category", () => {
    const result = discordEstimate("店舗の内装解体とスケルトン戻し50㎡");

    expect(result.message).toContain("内装解体");
    expect(result.message).toContain("解体・撤去");
    expect(result.estimate!.total).toBeGreaterThan(0);
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

describe("handleDiscordEstimateMessage", () => {
  it("工事メッセージ → ok=true + contentにMarkdownテーブル", () => {
    const reply = handleDiscordEstimateMessage("6畳の壁紙張替え");

    expect(reply.ok).toBe(true);
    expect(reply.content).toContain("| 品目 | 数量 | 単価 | 金額 |");
    expect(reply.content).toContain("税込合計");
    expect(reply.estimate).not.toBeNull();
    expect(reply.estimate!.total).toBeGreaterThan(0);
  });

  it("未マッチテキスト → ok=false + エラーメッセージ", () => {
    const reply = handleDiscordEstimateMessage("こんにちは");

    expect(reply.ok).toBe(false);
    expect(reply.content).toContain("工事内容を特定できませんでした");
    expect(reply.estimate).toBeNull();
  });

  it("空文字 → ok=false + 案内メッセージ", () => {
    const reply = handleDiscordEstimateMessage("");

    expect(reply.ok).toBe(false);
    expect(reply.content).toContain("メッセージが空です");
    expect(reply.estimate).toBeNull();
  });

  it("空白のみ → ok=false + 案内メッセージ", () => {
    const reply = handleDiscordEstimateMessage("   ");

    expect(reply.ok).toBe(false);
    expect(reply.estimate).toBeNull();
  });

  it("複数品目 → 複数セクションを含む見積を返す", () => {
    const reply = handleDiscordEstimateMessage("20㎡のタイルカーペット張替え、LED照明10台");

    expect(reply.ok).toBe(true);
    expect(reply.estimate!.sections.length).toBeGreaterThanOrEqual(2);
    expect(reply.content).toContain("タイルカーペット");
    expect(reply.content).toContain("LED");
  });

  it("メッセージ前後の空白はトリムされる", () => {
    const reply = handleDiscordEstimateMessage("  6畳の壁紙張替え  ");

    expect(reply.ok).toBe(true);
    expect(reply.content).toContain("6畳の壁紙張替え");
  });
});

describe("isEstimateRequest", () => {
  it("「見積」を含む → true", () => {
    expect(isEstimateRequest("見積を出してください")).toBe(true);
  });

  it("「工事」を含む → true", () => {
    expect(isEstimateRequest("壁紙工事はいくらですか")).toBe(true);
  });

  it("「壁紙」を含む → true", () => {
    expect(isEstimateRequest("6畳の壁紙張替え")).toBe(true);
  });

  it("「フローリング」を含む → true", () => {
    expect(isEstimateRequest("フローリングの費用は?")).toBe(true);
  });

  it("「エアコン」を含む → true", () => {
    expect(isEstimateRequest("エアコン設置お願いします")).toBe(true);
  });

  it("「estimate」(英字) → true", () => {
    expect(isEstimateRequest("estimate please")).toBe(true);
  });

  it("無関係なテキスト → false", () => {
    expect(isEstimateRequest("おはようございます")).toBe(false);
  });

  it("空文字 → false", () => {
    expect(isEstimateRequest("")).toBe(false);
  });
});
