import { useMemo } from "react";
import { useOrganization } from "./useOrganization.js";

export type Plan = "trial" | "basic" | "pro";

export type PlanLimits = {
  maxProjects: number | null;
  maxUsers: number | null;
  trialDays: number | null;
};

export type SubscriptionInfo = {
  plan: Plan;
  limits: PlanLimits;
  isTrialExpired: boolean;
  canCreateProject: (currentProjectCount: number) => boolean;
  canAddUser: (currentUserCount: number) => boolean;
};

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: { maxProjects: 3, maxUsers: 2, trialDays: 14 },
  basic: { maxProjects: 10, maxUsers: 5, trialDays: null },
  pro: { maxProjects: null, maxUsers: null, trialDays: null },
};

export function useSubscription(): SubscriptionInfo {
  const { organization } = useOrganization();

  return useMemo(() => {
    const plan: Plan = (organization?.plan as Plan | undefined) ?? "trial";
    const limits = PLAN_LIMITS[plan];

    const isTrialExpired =
      plan === "trial" &&
      organization?.planPeriodEnd != null &&
      new Date(organization.planPeriodEnd) < new Date();

    const canCreateProject = (currentProjectCount: number): boolean => {
      if (isTrialExpired) return false;
      if (limits.maxProjects === null) return true;
      return currentProjectCount < limits.maxProjects;
    };

    const canAddUser = (currentUserCount: number): boolean => {
      if (isTrialExpired) return false;
      if (limits.maxUsers === null) return true;
      return currentUserCount < limits.maxUsers;
    };

    return { plan, limits, isTrialExpired, canCreateProject, canAddUser };
  }, [organization?.plan, organization?.planPeriodEnd]);
}
