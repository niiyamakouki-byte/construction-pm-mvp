import { describe, it, expect } from "vitest";
import {
  analyzeSentiment,
  detectUrgency,
  analyzeConversation,
  suggestResponse,
  getConversationSummary,
} from "../lib/sentiment-analyzer";

describe("analyzeSentiment", () => {
  it("ポジティブなメッセージを検出", () => {
    const result = analyzeSentiment("ありがとうございます、助かるよ");
    expect(result.level).toBe("very_positive");
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.keywords).toContain("ありがとう");
    expect(result.keywords).toContain("助かる");
  });

  it("ネガティブなメッセージを検出", () => {
    const result = analyzeSentiment("工期が遅れていて困っています");
    expect(["negative", "very_negative"]).toContain(result.level);
    expect(result.score).toBeLessThan(0);
  });

  it("非常にネガティブなメッセージを検出", () => {
    const result = analyzeSentiment("契約解除を検討しています。弁護士に相談します");
    expect(result.level).toBe("very_negative");
    expect(result.score).toBe(-1);
    expect(result.confidence).toBe(0.9);
  });

  it("ニュートラルなメッセージ", () => {
    const result = analyzeSentiment("本日の作業報告です。以上");
    expect(result.level).toBe("neutral");
    expect(result.score).toBe(0);
  });

  it("キーワードなしはニュートラル低信頼度", () => {
    const result = analyzeSentiment("明日の天気は晴れです");
    expect(result.level).toBe("neutral");
    expect(result.confidence).toBe(0.5);
  });

  it("混合感情は平均化される", () => {
    const result = analyzeSentiment("ありがとうございます。ただ遅れが心配です");
    expect(result.score).toBeGreaterThan(-0.5);
    expect(result.score).toBeLessThan(0.5);
  });
});

describe("detectUrgency", () => {
  it("至急はcritical", () => {
    expect(detectUrgency("至急対応お願いします")).toBe("critical");
  });

  it("急ぎはhigh", () => {
    expect(detectUrgency("急ぎでお願いします")).toBe("high");
  });

  it("今週中はmedium", () => {
    expect(detectUrgency("今週中に回答ください")).toBe("medium");
  });

  it("通常メッセージはlow", () => {
    expect(detectUrgency("よろしくお願いします")).toBe("low");
  });

  it("criticalが最優先", () => {
    expect(detectUrgency("急ぎだけど至急ではないかも")).toBe("critical");
  });
});

describe("analyzeConversation", () => {
  it("空の会話はニュートラル", () => {
    const result = analyzeConversation([]);
    expect(result.overall).toBe("neutral");
    expect(result.trend).toBe("stable");
    expect(result.urgency).toBe("low");
  });

  it("ポジティブな会話を検出", () => {
    const messages = [
      { content: "ありがとうございます", author: "施主", timestamp: new Date("2024-01-01") },
      { content: "素晴らしい仕上がりですね", author: "施主", timestamp: new Date("2024-01-02") },
      { content: "最高です", author: "施主", timestamp: new Date("2024-01-03") },
    ];
    const result = analyzeConversation(messages);
    expect(result.overall).toBe("very_positive");
  });

  it("悪化トレンドを検出", () => {
    const messages = [
      { content: "ありがとうございます", author: "施主", timestamp: new Date("2024-01-01") },
      { content: "素晴らしいです", author: "施主", timestamp: new Date("2024-01-02") },
      { content: "少し心配です", author: "施主", timestamp: new Date("2024-01-03") },
      { content: "遅れが問題です", author: "施主", timestamp: new Date("2024-01-04") },
      { content: "困っています", author: "施主", timestamp: new Date("2024-01-05") },
    ];
    const result = analyzeConversation(messages);
    expect(result.trend).toBe("declining");
  });

  it("緊急度を最大値で返す", () => {
    const messages = [
      { content: "確認お願いします", author: "A", timestamp: new Date() },
      { content: "至急対応してください", author: "B", timestamp: new Date() },
    ];
    const result = analyzeConversation(messages);
    expect(result.urgency).toBe("critical");
  });
});

describe("suggestResponse", () => {
  it("very_negativeには謝罪を提案", () => {
    const suggestion = suggestResponse({ level: "very_negative", score: -1, confidence: 0.9, keywords: ["契約解除"] });
    expect(suggestion).toContain("謝罪");
  });

  it("positiveには感謝を提案", () => {
    const suggestion = suggestResponse({ level: "positive", score: 0.5, confidence: 0.7, keywords: ["了解"] });
    expect(suggestion).toContain("感謝");
  });

  it("neutralには事実を提案", () => {
    const suggestion = suggestResponse({ level: "neutral", score: 0, confidence: 0.5, keywords: [] });
    expect(suggestion).toContain("事実");
  });
});

describe("getConversationSummary", () => {
  it("configを受け取ってanalyzeConversationのラッパーとして動作", () => {
    const messages = [
      { content: "よろしくお願いします", author: "施主", timestamp: new Date() },
    ];
    const result = getConversationSummary(messages, { projectName: "KDX南青山" });
    expect(result.overall).toBeDefined();
    expect(result.trend).toBeDefined();
    expect(result.urgency).toBeDefined();
  });
});
