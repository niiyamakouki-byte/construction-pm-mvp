/**
 * owner-app/types.ts — 施主アプリ専用型定義
 */

export type OwnerSession = {
  token: string;
  projectId: string;
  expiresAt: number; // Unix ms
};

export type OwnerMessage = {
  id: string;
  sender: "owner" | "pm";
  text: string;
  ts: string; // ISO datetime
  attachments?: string[];
};

export type ChangeRequestStatus = "pending" | "reviewing" | "approved" | "rejected";

export type ChangeRequest = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  photo_urls: string[];
  status: ChangeRequestStatus;
  estimated_cost?: number;
  ts: string; // ISO datetime
};

export type OwnerPaymentMilestone = {
  id: string;
  label: string;
  scheduledDate: string;
  scheduledAmount: number;
  status: "planned" | "invoiced" | "paid" | "overdue" | "cancelled";
  actualPaidDate?: string;
};

export type OwnerDashboardSnapshot = {
  projectId: string;
  projectName: string;
  overallProgress: number; // 0-100
  currentPhase: string;
  todaysPhotos: string[];
  recentMessages: OwnerMessage[];
  pendingRequests: ChangeRequest[];
  paymentMilestones: OwnerPaymentMilestone[];
};
