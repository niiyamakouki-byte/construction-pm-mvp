import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useOrganizationContext } from "./OrganizationContext.js";
import { hasSupabaseEnv } from "../infra/supabase-client.js";
import type { PlanId } from "../lib/stripe.js";

export type SubscriptionLimits = {
  maxProjects: number | null;
  maxTasks: number | null;
};

export type SubscriptionContextValue = {
  plan: PlanId;
  limits: SubscriptionLimits;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planPeriodEnd: string | null;
  loading: boolean;
  canCreateProject: (currentCount: number) => boolean;
  canAddTask: (currentCount: number) => boolean;
};

const PLAN_LIMITS: Record<PlanId, SubscriptionLimits> = {
  free: { maxProjects: 1, maxTasks: 20 },
  standard: { maxProjects: null, maxTasks: null },
  pro: { maxProjects: null, maxTasks: null },
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  plan: "free",
  limits: PLAN_LIMITS.free,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  planPeriodEnd: null,
  loading: true,
  canCreateProject: () => false,
  canAddTask: () => false,
});

/**
 * Map legacy Organization plan values to the new PlanId type.
 * Organizations created before Stripe integration use "trial"/"basic"/"pro".
 */
function normalizePlan(raw: string | undefined | null): PlanId {
  if (raw === "standard" || raw === "pro") return raw;
  if (raw === "basic") return "standard"; // legacy mapping
  return "free"; // trial + unknown → free
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { organization, loading } = useOrganizationContext();

  const value = useMemo<SubscriptionContextValue>(() => {
    // Internal company use: treat Supabase-authenticated users as having full access
    const plan = hasSupabaseEnv() && !organization ? "pro" : normalizePlan(organization?.plan);
    const limits = PLAN_LIMITS[plan];

    const canCreateProject = (currentCount: number): boolean => {
      if (limits.maxProjects === null) return true;
      return currentCount < limits.maxProjects;
    };

    const canAddTask = (currentCount: number): boolean => {
      if (limits.maxTasks === null) return true;
      return currentCount < limits.maxTasks;
    };

    return {
      plan,
      limits,
      stripeCustomerId: organization?.stripeCustomerId ?? null,
      stripeSubscriptionId: organization?.stripeSubscriptionId ?? null,
      planPeriodEnd: organization?.planPeriodEnd ?? null,
      loading,
      canCreateProject,
      canAddTask,
    };
  }, [organization, loading]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
