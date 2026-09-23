import { isCapacitorNative } from "./capacitor-runtime.js";
import { explainProviderAuthError, getOAuthRedirectUrl, rememberPostAuthRoute } from "./auth-redirect.js";
import { GOOGLE_CALENDAR_SCOPE, openNativeOAuthUrl } from "./google-sign-in.js";
import type { AuthIdentity } from "../infra/supabase-client.js";

export type LinkingAuth = {
  getUserIdentities?: () => Promise<{
    data: { identities: AuthIdentity[] } | null;
    error: { message: string } | null;
  }>;
  linkIdentity?: (credentials: {
    provider: "google" | "apple";
    options?: {
      redirectTo?: string;
      scopes?: string;
      queryParams?: Record<string, string>;
      skipBrowserRedirect?: boolean;
    };
  }) => Promise<{ data: { url?: string | null } | null; error: { message: string; code?: string } | null }>;
  unlinkIdentity?: (identity: AuthIdentity) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  if (provider === "email") return "メール";
  return provider;
}

export async function loadLinkedIdentities(auth: LinkingAuth): Promise<{ identities: AuthIdentity[]; errorMessage: string | null }> {
  if (!auth.getUserIdentities) return { identities: [], errorMessage: null };
  const { data, error } = await auth.getUserIdentities();
  if (error) return { identities: [], errorMessage: "連携中のログイン方法を読み込めませんでした。" };
  return { identities: data?.identities ?? [], errorMessage: null };
}

export async function linkProvider(
  auth: LinkingAuth,
  provider: "google" | "apple",
): Promise<{ errorMessage: string | null }> {
  if (!auth.linkIdentity) {
    return { errorMessage: "このクライアントはアカウント連携に未対応です。" };
  }
  rememberPostAuthRoute("/account");
  const native = isCapacitorNative();
  const { data, error } = await auth.linkIdentity({
    provider,
    options: {
      redirectTo: getOAuthRedirectUrl(),
      ...(provider === "google"
        ? {
            scopes: GOOGLE_CALENDAR_SCOPE,
            queryParams: { access_type: "offline", prompt: "consent" },
          }
        : { scopes: "name email" }),
      ...(native ? { skipBrowserRedirect: true } : {}),
    },
  });
  if (error) return { errorMessage: explainProviderAuthError(error) };
  await openNativeOAuthUrl(data?.url ?? null);
  return { errorMessage: null };
}

export async function unlinkProvider(
  auth: LinkingAuth,
  identity: AuthIdentity,
  identities: AuthIdentity[],
): Promise<{ errorMessage: string | null }> {
  if (identities.length < 2) {
    return { errorMessage: "最後のログイン方法は解除できません。" };
  }
  if (!auth.unlinkIdentity) {
    return { errorMessage: "このクライアントは連携解除に未対応です。" };
  }
  const { error } = await auth.unlinkIdentity(identity);
  if (error) return { errorMessage: "連携を解除できませんでした。Supabase の Manual linking を有効にしてください。" };
  return { errorMessage: null };
}
