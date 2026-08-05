/**
 * 票 laporta-beads-79ere / Codex: 署名付き依頼リンクの承諾・辞退画面。
 * 保存は /api/share-token の署名検証済み respond アクションだけを通す。
 */
import { useEffect, useState } from "react";
import { respondToContractorRequest, verifySignedToken } from "../lib/share-token.js";

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; taskName: string }
  | { phase: "saving"; taskName: string }
  | { phase: "done"; status: "accepted" | "rejected" }
  | { phase: "error"; message: string };

export function ContractorRequestResponsePage({ token }: { token: string }) {
  const [state, setState] = useState<PageState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    void verifySignedToken(token).then((result) => {
      if (cancelled) return;
      if (
        result.valid &&
        result.purpose === "contractor_request" &&
        result.notificationId &&
        result.taskName
      ) {
        setState({ phase: "ready", taskName: result.taskName });
      } else if (result.expired) {
        setState({ phase: "error", message: "この依頼リンクの有効期限は切れています。" });
      } else {
        setState({ phase: "error", message: "この依頼リンクは無効です。" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function respond(response: "accepted" | "rejected") {
    if (state.phase !== "ready") return;
    const taskName = state.taskName;
    setState({ phase: "saving", taskName });
    try {
      await respondToContractorRequest(token, response);
      setState({ phase: "done", status: response });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "回答を保存できませんでした。",
      });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-brand-700">LapoSite 協力業者依頼</p>
        {state.phase === "loading" && <p className="mt-4 text-sm text-slate-500">依頼を確認中...</p>}
        {(state.phase === "ready" || state.phase === "saving") && (
          <>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{state.taskName}</h1>
            <p className="mt-2 text-sm text-slate-600">この工程依頼への回答を選択してください。</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={state.phase === "saving"}
                onClick={() => void respond("accepted")}
                className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                承諾する
              </button>
              <button
                type="button"
                disabled={state.phase === "saving"}
                onClick={() => void respond("rejected")}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                辞退する
              </button>
            </div>
            {state.phase === "saving" && <p className="mt-3 text-center text-xs text-slate-500">保存中...</p>}
          </>
        )}
        {state.phase === "done" && (
          <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
            <h1 className="font-bold text-emerald-800">
              {state.status === "accepted" ? "依頼を承諾しました" : "依頼を辞退しました"}
            </h1>
            <p className="mt-1 text-sm text-emerald-700">回答は担当者へ反映されました。</p>
          </div>
        )}
        {state.phase === "error" && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {state.message}
          </div>
        )}
      </section>
    </main>
  );
}
