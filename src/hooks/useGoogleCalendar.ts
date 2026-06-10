/**
 * useGoogleCalendar — Googleカレンダー(primary)の予定を期間指定で取得するフック。
 *
 * - sessionStorage に保持された provider_token (Supabase OAuth リダイレクト直後に捕捉) を使う
 * - token なし → { connected: false }（誘導はアカウント設定だけなのでUI側はサイレント）
 * - 401 → { needsReconnect: true } を立て、再連携バナーを表示する
 * - 再連携は同じ signInWithOAuth を再実行する reconnect() を公開
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPrimaryCalendarEvents,
  GoogleAuthExpiredError,
  type GoogleCalendarEvent,
} from "../lib/google-calendar.js";
import { readGoogleProviderToken } from "../contexts/AuthContext.js";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";

/** ログイン箇所と同じ redirectTo を組み立てる薄いヘルパー */
function buildOAuthRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/#/login`;
}

export type UseGoogleCalendarOptions = {
  /** 取得期間の開始（含む） */
  timeMin: Date | null;
  /** 取得期間の終了（含む） */
  timeMax: Date | null;
};

export type UseGoogleCalendarResult = {
  /** provider_token がある（= Google連携している）か */
  connected: boolean;
  /** 401 を受け取り再連携が必要な状態か */
  needsReconnect: boolean;
  /** 取得済みイベント */
  events: GoogleCalendarEvent[];
  /** 取得中 */
  loading: boolean;
  /** 取得エラー（401 以外） */
  error: Error | null;
  /** 再連携（Google OAuth を再実行） */
  reconnect: () => Promise<void>;
};

export function useGoogleCalendar(options: UseGoogleCalendarOptions): UseGoogleCalendarResult {
  const { timeMin, timeMax } = options;
  // SSR/テストで window がない場合は connected:false を維持する
  const [token, setToken] = useState<string | null>(() => readGoogleProviderToken());
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const minIso = useMemo(() => timeMin?.toISOString() ?? null, [timeMin]);
  const maxIso = useMemo(() => timeMax?.toISOString() ?? null, [timeMax]);

  useEffect(() => {
    if (!token || !timeMin || !timeMax) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPrimaryCalendarEvents(token, timeMin, timeMax)
      .then((fetched) => {
        if (cancelled) return;
        setEvents(fetched);
        setNeedsReconnect(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof GoogleAuthExpiredError) {
          setNeedsReconnect(true);
          setEvents([]);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // token / 期間が変わったときだけ再取得
  }, [token, minIso, maxIso, timeMin, timeMax]);

  const reconnect = useCallback(async () => {
    if (!hasSupabaseEnv()) return;
    const client = await getSupabaseClient();
    await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildOAuthRedirectUrl(),
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    // リダイレクトされるので戻ってこない。戻ってきた場合の保険として token を読み直す
    setToken(readGoogleProviderToken());
  }, []);

  return {
    connected: token !== null,
    needsReconnect,
    events,
    loading,
    error,
    reconnect,
  };
}
