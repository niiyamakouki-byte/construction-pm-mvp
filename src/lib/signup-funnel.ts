/**
 * signup-funnel — signup → trial 導線の計測
 *
 * どのステップで離脱するかを可視化するため、ファネル各段の到達イベントを
 * localStorage に追記する。既存の trackEvent (Vercel Analytics) にも転送するが、
 * Vercel 側は集計クエリができないため、ファネル表示用には localStorage を読む。
 */
import { trackEvent } from "./analytics.js";

// localStorage キー（OnboardingChecklist の genbahub_* 名前空間に合わせる）
const FUNNEL_KEY = "genbahub_signup_funnel";

// ファネルの順序付きステップ。実際にコードで発火できる境界のみを定義する。
export const FUNNEL_STEPS = [
  "signup_started",
  "signup_completed",
  "onboarding_started",
  "sample_project_seeded",
  "first_real_action",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

// 表示用の日本語ラベル
export const FUNNEL_STEP_LABELS: Record<FunnelStep, string> = {
  signup_started: "登録開始",
  signup_completed: "登録完了",
  onboarding_started: "初回セットアップ開始",
  sample_project_seeded: "サンプル案件作成",
  first_real_action: "最初の実アクション",
};

export type FunnelEvent = {
  step: FunnelStep;
  at: number;
};

function readEvents(): FunnelEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FUNNEL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is FunnelEvent =>
        typeof v === "object" &&
        v !== null &&
        FUNNEL_STEPS.includes((v as FunnelEvent).step) &&
        typeof (v as FunnelEvent).at === "number",
    );
  } catch {
    return [];
  }
}

function writeEvents(events: FunnelEvent[]): void {
  try {
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(events));
  } catch {
    // ignore quota errors
  }
}

/**
 * ファネルの 1 ステップ到達を記録する。
 * 既存 trackEvent にも転送しつつ、localStorage に追記して集計可能にする。
 */
export function trackFunnelStep(step: FunnelStep): void {
  if (typeof window === "undefined") return;
  trackEvent(step, { source: "signup_funnel" });
  const events = readEvents();
  events.push({ step, at: Date.now() });
  writeEvents(events);
}

export function getFunnelEvents(): FunnelEvent[] {
  return readEvents();
}

export type FunnelStepStat = {
  step: FunnelStep;
  label: string;
  count: number;
  /** 直前ステップからの遷移率（0-100, %）。先頭は 100。 */
  conversionFromPrev: number;
  /** 先頭ステップ比の到達率（0-100, %）。 */
  conversionFromTop: number;
  /** 直前ステップからの離脱率（0-100, %）。先頭は 0。 */
  dropOff: number;
};

/**
 * イベント列をステップごとに集計し、到達数・遷移率・離脱率を返す。
 */
export function aggregateFunnel(events: FunnelEvent[]): FunnelStepStat[] {
  const counts = new Map<FunnelStep, number>();
  for (const step of FUNNEL_STEPS) counts.set(step, 0);
  for (const ev of events) counts.set(ev.step, (counts.get(ev.step) ?? 0) + 1);

  const topCount = counts.get(FUNNEL_STEPS[0]) ?? 0;

  return FUNNEL_STEPS.map((step, index) => {
    const count = counts.get(step) ?? 0;
    const prevCount = index === 0 ? count : (counts.get(FUNNEL_STEPS[index - 1]) ?? 0);
    const conversionFromPrev = prevCount === 0 ? 0 : (count / prevCount) * 100;
    const conversionFromTop = topCount === 0 ? 0 : (count / topCount) * 100;
    return {
      step,
      label: FUNNEL_STEP_LABELS[step],
      count,
      conversionFromPrev: index === 0 ? 100 : conversionFromPrev,
      conversionFromTop,
      dropOff: index === 0 ? 0 : 100 - conversionFromPrev,
    };
  });
}
