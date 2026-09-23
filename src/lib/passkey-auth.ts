import { isCapacitorNative } from "./capacitor-runtime.js";

export type PasskeyAuth = {
  signInWithPasskey?: () => Promise<{
    data: { session: unknown; user?: { email?: string } | null };
    error: { message: string; code?: string } | null;
  }>;
  registerPasskey?: () => Promise<{
    data: { id?: string; friendly_name?: string } | null;
    error: { message: string; code?: string } | null;
  }>;
};

export function isPasskeyUiAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.PublicKeyCredential === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Capacitor のバンドルは `https://localhost`。本番 RP ID
 * `construction-pm-mvp.vercel.app` とは資格情報を共有できない。
 */
export function passkeyUsesSeparateOrigin(): boolean {
  if (!isCapacitorNative() || typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function explainPasskeyError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (msg.includes("passkey_disabled")) {
    return "パスキーはまだ有効になっていません。Google、Apple、またはマジックリンクでログインしてください。";
  }
  if (msg.includes("abort") || msg.includes("not allowed") || msg.includes("cancel")) {
    return "パスキーの操作をキャンセルしました。";
  }
  return "この端末ではパスキーでログインできません。Google、Apple、またはマジックリンクを使ってください。";
}

export async function signInWithDevicePasskey(auth: PasskeyAuth): Promise<{ errorMessage: string | null }> {
  if (passkeyUsesSeparateOrigin()) {
    return {
      errorMessage: "アプリ内のパスキーは本番サイトと別です。Google、Apple、またはマジックリンクでログインしてください。",
    };
  }
  if (!isPasskeyUiAvailable() || !auth.signInWithPasskey) {
    return {
      errorMessage: "このブラウザはパスキーに未対応です。Google、Apple、またはマジックリンクでログインしてください。",
    };
  }
  try {
    const { error } = await auth.signInWithPasskey();
    if (error) return { errorMessage: explainPasskeyError(error) };
    return { errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { errorMessage: explainPasskeyError({ message }) };
  }
}

export async function registerDevicePasskey(auth: PasskeyAuth): Promise<{ errorMessage: string | null; friendlyName?: string }> {
  if (passkeyUsesSeparateOrigin()) {
    return { errorMessage: "アプリ内（localhost）では本番のパスキーを登録できません。ブラウザの本番サイトから登録してください。" };
  }
  if (!isPasskeyUiAvailable() || !auth.registerPasskey) {
    return { errorMessage: "このブラウザはパスキーに未対応です。" };
  }
  try {
    const { data, error } = await auth.registerPasskey();
    if (error) return { errorMessage: explainPasskeyError(error) };
    return { errorMessage: null, friendlyName: data?.friendly_name };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { errorMessage: explainPasskeyError({ message }) };
  }
}
