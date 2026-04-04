import { useState, useEffect, useCallback } from "react";

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
  icon: string;
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
    icon: "📊",
    targetAttr: "gantt-chart",
    position: "bottom",
  },
  {
    id: 2,
    title: "タスクを追加するには",
    description:
      "「＋追加」ボタンをタップするとタスクを追加できます。工事名・担当業者・日程を入力してください。",
    icon: "➕",
    targetAttr: "add-task-btn",
    position: "bottom",
  },
  {
    id: 3,
    title: "ドラッグで日数変更",
    description:
      "タスクバーの右端をドラッグすると工期を伸ばせます。バー全体をドラッグすると開始日を動かせます。",
    icon: "↔️",
    targetAttr: "gantt-task-bar",
    position: "top",
  },
  {
    id: 4,
    title: "業者管理はここ",
    description:
      "下のナビ「業者」タブから、工事に関わる業者を登録・管理できます。",
    icon: "🏢",
    targetAttr: "nav-contractors",
    position: "top",
  },
  {
    id: 5,
    title: "困ったときはヘルプ",
    description:
      "よくある質問や使い方は「ヘルプ」ページに載っています。右上のメニューからいつでも確認できます。",
    icon: "❓",
    targetAttr: "help-link",
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

  const updateHighlight = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(
      `[data-tour="${currentStep.targetAttr}"]`,
    ) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight);
    return () => {
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight);
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
      // If overflows viewport bottom, flip to top
      if (t + CARD_HEIGHT > vh) {
        top = `${highlightRect.top - CARD_HEIGHT - OFFSET}px`;
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
          <span className="text-2xl">{step.icon}</span>
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
