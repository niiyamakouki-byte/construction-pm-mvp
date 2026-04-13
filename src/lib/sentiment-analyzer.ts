// src/lib/sentiment-analyzer.ts
// 建設業の顧客・協力会社チャット感情分析

export type SentimentLevel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface SentimentResult {
  level: SentimentLevel;
  score: number;
  confidence: number;
  keywords: string[];
  suggestion?: string;
}

export interface ConversationTone {
  overall: SentimentLevel;
  trend: 'improving' | 'stable' | 'declining';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keyPhrases: string[];
}

const sentimentKeywords: Record<SentimentLevel, { keywords: string[]; score: number }> = {
  very_positive: { keywords: ['ありがとう', '感謝', '素晴らしい', '助かる', '最高', '完璧', 'お疲れ様', '嬉しい'], score: 1.0 },
  positive: { keywords: ['よろしく', '了解', '大丈夫', '問題ない', 'いいね', 'OK', '承知', 'お願い'], score: 0.5 },
  neutral: { keywords: ['確認', '報告', '連絡', '共有', '以上', 'お知らせ'], score: 0.0 },
  negative: { keywords: ['困る', '遅れ', '問題', '不具合', 'クレーム', '催促', '不満', '心配', '懸念'], score: -0.5 },
  very_negative: { keywords: ['怒', '激怒', '訴訟', '契約解除', '損害', '裁判', '弁護士', '違約', '詐欺'], score: -1.0 },
};

const urgencyKeywords: Record<'critical' | 'high' | 'medium', string[]> = {
  critical: ['至急', '緊急', '今すぐ', '本日中', '直ちに'],
  high: ['急ぎ', '早急', '明日まで', 'ASAP', '早めに'],
  medium: ['なるべく早く', '今週中', 'できれば', 'お手すきで'],
};

function scoreToLevel(score: number): SentimentLevel {
  if (score >= 0.75) return 'very_positive';
  if (score >= 0.25) return 'positive';
  if (score > -0.25) return 'neutral';
  if (score > -0.75) return 'negative';
  return 'very_negative';
}

export function analyzeSentiment(message: string): SentimentResult {
  const matched: string[] = [];
  let totalScore = 0;
  let count = 0;

  for (const level of Object.keys(sentimentKeywords) as SentimentLevel[]) {
    const { keywords, score } = sentimentKeywords[level];
    for (const kw of keywords) {
      if (message.includes(kw)) {
        matched.push(kw);
        totalScore += score;
        count++;
      }
    }
  }

  const finalScore = count > 0 ? totalScore / count : 0;
  const hasStrong = matched.some(
    (kw) =>
      sentimentKeywords.very_positive.keywords.includes(kw) ||
      sentimentKeywords.very_negative.keywords.includes(kw),
  );
  const confidence = count > 0 ? (hasStrong ? 0.9 : 0.7) : 0.5;

  return {
    level: scoreToLevel(finalScore),
    score: Math.max(-1, Math.min(1, finalScore)),
    confidence,
    keywords: [...new Set(matched)],
  };
}

export function detectUrgency(message: string): 'low' | 'medium' | 'high' | 'critical' {
  if (urgencyKeywords.critical.some((kw) => message.includes(kw))) return 'critical';
  if (urgencyKeywords.high.some((kw) => message.includes(kw))) return 'high';
  if (urgencyKeywords.medium.some((kw) => message.includes(kw))) return 'medium';
  return 'low';
}

export function analyzeConversation(
  messages: { content: string; author: string; timestamp: Date }[],
): ConversationTone {
  if (messages.length === 0) {
    return { overall: 'neutral', trend: 'stable', urgency: 'low', keyPhrases: [] };
  }

  const results = messages.map((m) => analyzeSentiment(m.content));
  const scores = results.map((r) => r.score);
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const last3 = scores.slice(-3);
  const last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : overallScore;

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (last3Avg > overallScore + 0.1) trend = 'improving';
  else if (last3Avg < overallScore - 0.1) trend = 'declining';

  const urgencyOrder = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  let maxUrgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  for (const m of messages) {
    const u = detectUrgency(m.content);
    if (urgencyOrder[u] > urgencyOrder[maxUrgency]) maxUrgency = u;
  }

  const keyPhrases = [...new Set(results.flatMap((r) => r.keywords))];

  return { overall: scoreToLevel(overallScore), trend, urgency: maxUrgency, keyPhrases };
}

export function suggestResponse(sentiment: SentimentResult): string {
  switch (sentiment.level) {
    case 'very_negative':
      return 'まず謝罪し、具体的な対応策と期限を提示してください。担当者を明確にし、経過報告の頻度を約束してください。';
    case 'negative':
      return '相手の懸念に共感を示した上で、具体的な解決策を提示してください。';
    case 'neutral':
      return '簡潔に事実のみを伝えてください。';
    case 'positive':
      return '感謝を伝え、次のアクションを明確にしてください。';
    case 'very_positive':
      return '感謝を伝え、今後の協力関係の継続を確認してください。';
  }
}

export function getConversationSummary(
  messages: { content: string; author: string; timestamp: Date }[],
  _config: { projectName: string },
): ConversationTone {
  return analyzeConversation(messages);
}
