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
  trialEndsAt: string | null;
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

/**
 * 招待リンク経由のサインアップ判定（AC③、票construction_pm_mvp-1g7）。
 *
 * 招待発行時に Supabase Admin generateLink の `data` へ埋め込んだ
 * invited_organization_id / invited_role を user_metadata から読み取る。
 * 無ければ通常の自己組織作成フローとみなし null を返す。
 */
export function resolveInvitedMembership(
  userMetadata: Record<string, unknown> | undefined,
): { organizationId: string; role: string } | null {
  const organizationId = userMetadata?.invited_organization_id;
  if (typeof organizationId !== "string" || !organizationId) return null;
  const role = userMetadata?.invited_role;
  return { organizationId, role: typeof role === "string" && role ? role : "member" };
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>;
};

async function fetchOrganization(orgId: string): Promise<Organization> {
  const client = await getSupabaseClient();

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
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function ensureOrganization(
  userId: string,
  companyName: string,
): Promise<Organization> {
  const client = await getSupabaseClient();

  // SECURITY DEFINER 関数でRLSをバイパスして組織を確実に取得/作成
  const { data: orgId, error: rpcError } = await (client as unknown as RpcClient).rpc(
    "ensure_user_organization",
    { p_user_id: userId, p_org_name: companyName || "My Organization" },
  );

  if (rpcError || !orgId) {
    throw new Error(rpcError?.message ?? "Failed to ensure organization");
  }

  return fetchOrganization(orgId);
}

/**
 * 招待リンク経由の新規ユーザーを招待元organizationへ参加させる（AC③）。
 * ensure_user_organizationとは違い新規organizationを作らず、指定organizationへ
 * 参加するだけの冪等RPC（join_invited_organization）を呼ぶ。
 */
async function joinInvitedOrganization(
  userId: string,
  organizationId: string,
  role: string,
): Promise<Organization> {
  const client = await getSupabaseClient();

  const { data: orgId, error: rpcError } = await (client as unknown as RpcClient).rpc(
    "join_invited_organization",
    { p_user_id: userId, p_organization_id: organizationId, p_role: role },
  );

  if (rpcError || !orgId) {
    throw new Error(rpcError?.message ?? "Failed to join invited organization");
  }

  return fetchOrganization(orgId);
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !hasSupabaseEnv()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ユーザー未認証時に組織情報をリセットする初期化パターン
      setOrganization(null);
      setLoading(false);
      return;
    }

    let disposed = false;
    setLoading(true);
    const companyName =
      (user.user_metadata?.company_name as string | undefined) ?? "";
    const invited = resolveInvitedMembership(user.user_metadata);

    const setup = invited
      ? joinInvitedOrganization(user.id, invited.organizationId, invited.role)
      : ensureOrganization(user.id, companyName);

    void setup
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
