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

  // SECURITY DEFINER 関数でRLSをバイパスして組織を確実に取得/作成
  const { data: orgId, error: rpcError } = await (client as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc("ensure_user_organization", {
    p_user_id: userId,
    p_org_name: companyName || "My Organization",
  });

  if (rpcError || !orgId) {
    throw new Error(rpcError?.message ?? "Failed to ensure organization");
  }

  // 組織情報を取得
  const { data: org, error: orgError } = await client
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    throw new Error(orgError?.message ?? "Failed to fetch organization");
  }

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

    let disposed = false;
    setLoading(true);
    const companyName =
      (user.user_metadata?.company_name as string | undefined) ?? "";

    void ensureOrganization(user.id, companyName)
      .then((org) => {
        if (!disposed) {
          setOrganization(org);
        }
      })
      .catch((err) => {
        if (!disposed) {
          console.error("Organization setup failed:", err);
          setOrganization(null);
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [user, user?.id]);

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
