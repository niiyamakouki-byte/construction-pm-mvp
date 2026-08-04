/**
 * AI稼働の常時可視化 v1 (laporta-beads-na12i)。
 *
 * GenbaHub内の各AI機能(提案書生成/施主提案プラン等)が生成を終えた時に
 * reportAiActivity() を1回呼ぶだけで、ヘッダーの AiActivityIndicator に反映される。
 * 既存の `genbahub:assistant-open` (App.tsx) と同じ window CustomEvent 方式を踏襲。
 * ponytail: ポーリング・常駐監視・サーバー往復は無し。受動的なイベント駆動のみ。
 */

export type AiActivityEvent = {
  id: string;
  label: string;
  ts: number;
};

const EVENT_NAME = "genbahub:ai-activity";

/** AI生成完了を報告する。labelはヘッダー通知にそのまま表示される (例: "AIが提案書を作成しました") */
export function reportAiActivity(label: string): void {
  if (typeof window === "undefined") return;
  const detail: AiActivityEvent = { id: `ai-${Date.now()}`, label, ts: Date.now() };
  window.dispatchEvent(new CustomEvent<AiActivityEvent>(EVENT_NAME, { detail }));
}

export function subscribeAiActivity(handler: (event: AiActivityEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AiActivityEvent>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
