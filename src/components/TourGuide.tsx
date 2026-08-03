import { type ReactNode, useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart3,
  Plus,
  MoveHorizontal,
  Download,
  PieChart,
} from "lucide-react";

const TOUR_KEY = "genbahub_tour_done";

export function useTourDone(): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(TOUR_KEY) === "1";
    } catch {
      return false;
    }
  });

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // ignore
    }
    setDone(true);
  }, []);

  return [done, markDone];
}

type TourStep = {
  id: number;
  title: string;
  description: string;
  icon: ReactNode;
  /** data-tour attribute value to highlight */
  targetAttr: string;
  /** Popover position relative to highlighted element */
  position: "top" | "bottom" | "left" | "right";
};

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "ここが工程表です",
    description:
      "ガントチャートで工事の流れを一目で確認できます。横バーをドラッグして日程を調整できます。",
    icon: <BarChart3 className="h-6 w-6" />,
    targetAttr: "gantt-chart",
    position: "bottom",
  },
  {
    id: 2,
    title: "タスクを追加するには",
    description:
      "「＋追加」ボタンをタップするとタスクを追加できます。工事名・担当業者・日程を入力してください。",
    icon: <Plus className="h-6 w-6" />,
    targetAttr: "add-task-btn",
    position: "bottom",
  },
  {
    id: 3,
    title: "ドラッグで日数変更",
    description:
      "タスクバーの右端をドラッグすると工期を伸ばせます。バー全体をドラッグすると開始日を動かせます。",
    icon: <MoveHorizontal className="h-6 w-6" />,
    targetAttr: "gantt-task-bar",
    position: "top",
  },
  {
    id: 4,
    title: "PDFやカレンダーに出力",
    description:
      "「出力」からPDF印刷やカレンダー(.ics)書き出しができます。",
    icon: <Download className="h-6 w-6" />,
    // laporta-beads-zrkir: 旧targetAttr="nav-contractors"は業者ナビ項目自体が
    // 折りたたみ済みの「その他」ドロワー+アコーディオン背後にあり、自動ツアー中は
    // querySelectorで到達不能(highlightRectが実質無意味な状態)と判明したため、
    // 常時レンダリングされるGanttPageの「出力」メニューへ差し替え。
    targetAttr: "gantt-output-menu",
    position: "bottom",
  },
  {
    id: 5,
    title: "リソースやリスクを分析",
    description:
      "「分析」から工程のリスク計算やリソース稼働状況を確認できます。",
    icon: <PieChart className="h-6 w-6" />,
    // laporta-beads-zrkir: 旧targetAttr="help-link"も同様にヘルプナビ項目が
    // 折りたたみUI背後で自動ツアー中は到達不能だったため、常時レンダリングされる
    // GanttPageの「分析」メニューへ差し替え。
    targetAttr: "gantt-analysis-menu",
    position: "bottom",
  },
];

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  onComplete: () => void;
};

export function TourGuide({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const scrolledStepRef = useRef<number | null>(null);

  const updateHighlight = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(
      `[data-tour="${currentStep.targetAttr}"]`,
    ) as HTMLElement | null;
    if (el) {
      // laporta-beads-zrkir: 対象がスクロール可能な一覧の途中(下の方)にあると画面外のまま
      // ポップオーバー位置も画面外になる。ステップが切り替わった最初の1回だけ画面内へ寄せる
      // (毎回scrollIntoViewするとscrollイベント→再測定→再スクロールのループになるため
      // ステップごとに1回に限定)。
      if (scrolledStepRef.current !== currentStep.id) {
        scrolledStepRef.current = currentStep.id;
        el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      }
      // laporta-beads-zrkir: ハイライト枠/ポップオーバーは fixed inset-0 の子として
      // 描画されるため、この時点でのcontaining blockは常にビューポート。
      // window.scrollY/Xを足すとスクロール後にビューポート座標とドキュメント座標が
      // ずれてポップオーバーが画面外に飛ぶ(scrollIntoViewで実際に踏んだ不具合)。
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ステップ変化時にハイライト位置を更新する同期パターン
    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight);
    // laporta-beads-zrkir: TourGuideは対象ページ(GanttPage等)のデータ読込完了より先に
    // マウントされうる。対象要素がまだDOMに無いと通常はresize/scrollが起きるまで
    // highlightRectがnullのままになるため、マウント直後の短時間だけ再試行する。
    const retry = window.setInterval(updateHighlight, 200);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 3000);
    return () => {
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight);
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
    };
  }, [updateHighlight]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      onComplete();
    }
  };

  if (!currentStep) return null;

  const PADDING = 8;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Dark overlay with cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ mixBlendMode: "normal" }}
        onClick={handleNext}
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left - PADDING}
                y={highlightRect.top - PADDING}
                width={highlightRect.width + PADDING * 2}
                height={highlightRect.height + PADDING * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Highlight border */}
      {highlightRect && (
        <div
          className="absolute rounded-xl ring-4 ring-brand-400 ring-offset-0 pointer-events-none"
          style={{
            top: highlightRect.top - PADDING,
            left: highlightRect.left - PADDING,
            width: highlightRect.width + PADDING * 2,
            height: highlightRect.height + PADDING * 2,
          }}
        />
      )}

      {/* Popover card */}
      <TourPopover
        step={currentStep}
        stepIndex={stepIndex}
        total={TOUR_STEPS.length}
        highlightRect={highlightRect}
        onNext={handleNext}
        onSkip={onComplete}
      />
    </div>
  );
}

type PopoverProps = {
  step: TourStep;
  stepIndex: number;
  total: number;
  highlightRect: HighlightRect | null;
  onNext: () => void;
  onSkip: () => void;
};

function TourPopover({
  step,
  stepIndex,
  total,
  highlightRect,
  onNext,
  onSkip,
}: PopoverProps) {
  const isLast = stepIndex === total - 1;
  const CARD_WIDTH = 300;
  const CARD_HEIGHT = 180;
  const OFFSET = 16;

  let top = "50%";
  let left = "50%";
  let transform = "translate(-50%, -50%)";

  if (highlightRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (step.position === "bottom") {
      const t = highlightRect.top + highlightRect.height + OFFSET;
      const l = Math.min(
        Math.max(highlightRect.left + highlightRect.width / 2 - CARD_WIDTH / 2, 16),
        vw - CARD_WIDTH - 16,
      );
      top = `${t}px`;
      left = `${l}px`;
      transform = "none";
      // If overflows viewport bottom, flip to top (laporta-beads-zrkir: top方向のclampが
      // 無いと、対象が画面下端に近い狭幅ビューポートで負のtop=画面外に飛ぶ)
      if (t + CARD_HEIGHT > vh) {
        top = `${Math.max(highlightRect.top - CARD_HEIGHT - OFFSET, 16)}px`;
      }
    } else if (step.position === "top") {
      const t = highlightRect.top - CARD_HEIGHT - OFFSET;
      const l = Math.min(
        Math.max(highlightRect.left + highlightRect.width / 2 - CARD_WIDTH / 2, 16),
        vw - CARD_WIDTH - 16,
      );
      top = `${Math.max(t, 16)}px`;
      left = `${l}px`;
      transform = "none";
    }
  }

  return (
    <div
      className="absolute pointer-events-auto"
      style={{ top, left, transform, width: CARD_WIDTH, zIndex: 60 }}
      role="dialog"
      aria-label={`ツアーガイド: ${step.title}`}
    >
      <div className="rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-brand-500 px-4 py-3 flex items-center gap-2">
          <span className="flex items-center">{step.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm truncate">{step.title}</p>
            <p className="text-brand-200 text-xs">
              {stepIndex + 1} / {total}
            </p>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-slate-700 leading-relaxed">{step.description}</p>
        </div>
        <div className="flex items-center gap-2 px-4 pb-4">
          <button
            onClick={onNext}
            className="h-[48px] flex-1 rounded-xl bg-brand-500 text-sm font-bold text-white hover:bg-brand-600 active:bg-brand-700 transition-colors"
          >
            {isLast ? "完了" : "次へ →"}
          </button>
          {!isLast && (
            <button
              onClick={onSkip}
              className="h-[48px] rounded-xl px-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              スキップ
            </button>
          )}
        </div>
        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-3">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`inline-block h-1.5 rounded-full transition-all ${
                i === stepIndex ? "w-4 bg-brand-500" : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
