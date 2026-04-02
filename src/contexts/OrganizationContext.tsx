import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { useAuth } from "./AuthContext.js";

export type Organization = {
  id: string;
  name: string;
  plan: "trial" | "basic" | "pro";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrganizationContextValue = {
  organization: Organization | null;
  organizationId: string | null;
  loading: boolean;
};

export const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  organizationId: null,
  loading: true,
});

async function ensureOrganization(
  userId: string,
  companyName: string,
): Promise<Organization> {
  const client = await getSupabaseClient();

  // Check if user already has an organization
  const { data: memberships } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberships) {
    const orgId = (memberships as { organization_id: string }).organization_id;
    const { data: org } = await client
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (org) {
      const row = org as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        plan: (row.plan as "trial" | "basic" | "pro") ?? "trial",
        stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
        stripeSubscriptionId:
          (row.stripe_subscription_id as string | null) ?? null,
        planPeriodEnd: (row.plan_period_end as string | null) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }
  }

  // Create a new organization
  const { data: newOrg, error: orgError } = await client
    .from("organizations")
    .insert({ name: companyName || "My Organization", plan: "trial" })
    .select("*")
    .single();

  if (orgError || !newOrg) {
    throw new Error(orgError?.message ?? "Failed to create organization");
  }

  const newRow = newOrg as Record<string, unknown>;

  // Add user as owner
  await client.from("organization_members").insert({
    user_id: userId,
    organization_id: newRow.id,
    role: "owner",
  });

  return {
    id: newRow.id as string,
    name: newRow.name as string,
    plan: (newRow.plan as "trial" | "basic" | "pro") ?? "trial",
    stripeCustomerId: (newRow.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId:
      (newRow.stripe_subscription_id as string | null) ?? null,
    planPeriodEnd: (newRow.plan_period_end as string | null) ?? null,
    createdAt: newRow.created_at as string,
    updatedAt: newRow.updated_at as string,
  };
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !hasSupabaseEnv()) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const companyName =
      (user.user_metadata?.company_name as string | undefined) ?? "";

    ensureOrganization(user.id, companyName)
      .then((org) => {
        setOrganization(org);
      })
      .catch((err) => {
        console.error("Organization setup failed:", err);
        setOrganization(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.id]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizationId: organization?.id ?? null,
        loading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext(): OrganizationContextValue {
  return useContext(OrganizationContext);
}
