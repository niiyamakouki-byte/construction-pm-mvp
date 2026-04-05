import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary.js";

type Props = {
  children: ReactNode;
};

export function TodayDashboardPageErrorBoundary({ children }: Props) {
  return <ErrorBoundary fallbackTitle="ダッシュボードエラー">{children}</ErrorBoundary>;
}

export function EstimatePageErrorBoundary({ children }: Props) {
  return <ErrorBoundary fallbackTitle="見積エラー">{children}</ErrorBoundary>;
}

export function GanttPageErrorBoundary({ children }: Props) {
  return <ErrorBoundary fallbackTitle="ガントチャートエラー">{children}</ErrorBoundary>;
}
