/** laporta-beads-yf4or — Codex implementation, 2026-08-07. */
import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { getSupabaseClient } from "../infra/supabase-client.js";
import { createPhotoShare } from "../lib/photo-share.js";

export function PhotoShareButton({ projectId }: { projectId: string }) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issueAndCopy() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const client = await getSupabaseClient();
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("ログイン情報を確認できませんでした");
      const { token } = await createPhotoShare(projectId, expiresInDays, accessToken);
      const base = window.location.origin + window.location.pathname;
      await navigator.clipboard.writeText(`${base}#/share/${encodeURIComponent(token)}`);
      setMessage(`リンクをコピーしました（${expiresInDays}日間有効）`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "共有リンクの発行に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="sr-only" htmlFor="photo-share-expiry">共有リンクの有効期限</label>
      <select
        id="photo-share-expiry"
        value={expiresInDays}
        onChange={(event) => setExpiresInDays(Number(event.target.value))}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#6B8E5A] focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/20"
      >
        <option value={1}>1日</option>
        <option value={7}>7日</option>
        <option value={30}>30日</option>
      </select>
      <button
        type="button"
        disabled={busy || !projectId}
        onClick={() => void issueAndCopy()}
        className="inline-flex items-center gap-2 rounded-xl bg-[#6B8E5A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#587849] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {message ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
        {busy ? "発行中..." : "施主に共有"}
      </button>
      <span className={`basis-full text-right text-xs ${error ? "text-red-600" : "text-[#587849]"}`} role={error ? "alert" : "status"}>
        {error ?? message}
      </span>
    </div>
  );
}
