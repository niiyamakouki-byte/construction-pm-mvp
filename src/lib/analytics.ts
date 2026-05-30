import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;

export function trackEvent(name: string, properties?: Record<string, AnalyticsValue>): void {
  if (typeof window === "undefined") return;
  track(name, properties);
}
