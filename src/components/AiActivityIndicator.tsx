import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { subscribeAiActivity, type AiActivityEvent } from "../lib/ai-activity-bus.js";

const NOTICE_DURATION_MS = 5000;

/**
 * AI稼働の常時可視化 v1 (laporta-beads-na12i)。
 * ヘッダー隅の小さなドット + 直近のAI完了通知を短時間表示する。
 * 通常時は待機中の控えめなグレードットのみ (装飾を増やさない、genbahub-ui準拠)。
 */
export function AiActivityIndicator() {
  const [latest, setLatest] = useState<AiActivityEvent | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeAiActivity((event) => {
      setLatest(event);
      setNoticeVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setNoticeVisible(false), NOTICE_DURATION_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className="relative flex items-center px-1"
      title={latest ? `直近のAI稼働: ${latest.label}` : "AI稼働状況: 待機中"}
      data-testid="ai-activity-indicator"
    >
      <span
        className="flex h-2 w-2 rounded-full transition-colors duration-300"
        style={{ background: latest ? "#6B8E5A" : "#CBD5E1" }}
        aria-hidden="true"
      />
      {noticeVisible && latest && (
        <div
          role="status"
          className="absolute right-0 top-6 z-40 flex max-w-[220px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs shadow-sm"
          style={{ background: "#EDF3EC", borderColor: "rgba(52,101,56,0.2)", color: "#346538" }}
        >
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{latest.label}</span>
        </div>
      )}
    </div>
  );
}
