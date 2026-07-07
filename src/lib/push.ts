/**
 * Web Push client helpers for GenbaHub.
 *
 * Flow: request permission → subscribe via the active service worker's
 * pushManager (VAPID) → persist the subscription server-side. A test push can
 * then be triggered against the caller's own subscriptions.
 */
import { getSupabaseClient } from "../infra/supabase-client.js";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function getVapidPublicKey(): string {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!key) {
    throw new Error(
      "プッシュ通知の公開鍵（VITE_VAPID_PUBLIC_KEY）が未設定です。",
    );
  }
  return key;
}

/** Convert a URL-safe base64 VAPID key into the Uint8Array pushManager expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function getAccessToken(): Promise<string> {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  return token;
}

/** Whether the current browser already holds a push subscription. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Request permission, subscribe, and persist the subscription server-side.
 * Returns the subscription. Throws with a Japanese message on failure.
 */
export async function enablePush(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("この端末/ブラウザはプッシュ通知に対応していません。");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("通知が許可されませんでした。");
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()) as BufferSource,
    }));

  const token = await getAccessToken();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `購読の保存に失敗しました (HTTP ${res.status})`);
  }

  return subscription;
}

/** Send a test push to the caller's own registered subscriptions. */
export async function sendTestPush(): Promise<{ sent: number }> {
  const token = await getAccessToken();
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `テスト送信に失敗しました (HTTP ${res.status})`);
  }
  return (await res.json()) as { sent: number };
}
