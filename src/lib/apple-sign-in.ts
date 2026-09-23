import { isCapacitorNative } from "./capacitor-runtime.js";
import { explainProviderAuthError, getOAuthRedirectUrl, rememberPostAuthRoute } from "./auth-redirect.js";
import { openNativeOAuthUrl } from "./google-sign-in.js";

export type AppleOAuthRequest = {
  provider: "apple";
  options: {
    redirectTo: string;
    scopes: "name email";
    skipBrowserRedirect?: boolean;
  };
};

export type AppleAuthClient = {
  signInWithOAuth(request: AppleOAuthRequest): Promise<{
    data: { url?: string | null } | null;
    error: { message: string; code?: string } | null;
  }>;
};

export function buildAppleOAuthRequest(): AppleOAuthRequest {
  const native = isCapacitorNative();
  return {
    provider: "apple",
    options: {
      redirectTo: getOAuthRedirectUrl(),
      scopes: "name email",
      ...(native ? { skipBrowserRedirect: true } : {}),
    },
  };
}

export async function startAppleOAuth(
  auth: AppleAuthClient,
  options?: { postAuthRoute?: string },
): Promise<{ errorMessage: string | null }> {
  if (options?.postAuthRoute) rememberPostAuthRoute(options.postAuthRoute);
  const { data, error } = await auth.signInWithOAuth(buildAppleOAuthRequest());
  if (error) return { errorMessage: explainProviderAuthError(error) };
  await openNativeOAuthUrl(data?.url ?? null);
  return { errorMessage: null };
}
