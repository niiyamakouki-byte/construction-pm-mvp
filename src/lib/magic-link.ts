import { explainProviderAuthError, getMagicLinkRedirectUrl } from "./auth-redirect.js";

export type MagicLinkAuth = {
  signInWithOtp(credentials: {
    email: string;
    options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
  }): Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  verifyOtp?(params: {
    email: string;
    token: string;
    type: "email";
  }): Promise<{ data: { session: unknown }; error: { message: string } | null }>;
};

export function buildMagicLinkRequest(email: string) {
  return {
    email: email.trim(),
    options: {
      emailRedirectTo: getMagicLinkRedirectUrl(),
      shouldCreateUser: true,
    },
  };
}

export async function sendMagicLink(auth: MagicLinkAuth, email: string): Promise<{ errorMessage: string | null }> {
  const { error } = await auth.signInWithOtp(buildMagicLinkRequest(email));
  if (error) return { errorMessage: explainProviderAuthError(error) };
  return { errorMessage: null };
}

export async function verifyMagicLinkCode(
  auth: MagicLinkAuth,
  email: string,
  token: string,
): Promise<{ errorMessage: string | null }> {
  if (!auth.verifyOtp) {
    return { errorMessage: "確認コードに未対応のクライアントです。メールのリンクを開いてください。" };
  }
  const { error } = await auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("expired") || msg.includes("invalid")) {
      return { errorMessage: "コードが正しくないか、期限切れです。もう一度メールを送ってください。" };
    }
    return { errorMessage: "コードを確認できませんでした。もう一度お試しください。" };
  }
  return { errorMessage: null };
}
