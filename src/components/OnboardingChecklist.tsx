import { useState, useCallback } from "react";
import { navigate } from "../hooks/useHashRouter.js";
import { trackFunnelStep } from "../lib/signup-funnel.js";

// localStorage キー（OnboardingWizard の ONBOARDING_KEY と名前空間が異なる）
const CHECKLIST_KEY = "genbahub_checklist_steps";

type StepId = "create_project" | "try_estimate" | "upload_photo";

const STEP_IDS: StepId[] = ["create_project", "try_estimate", "upload_photo"];

function readCompletedSteps(): Set<StepId> {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is StepId => STEP_IDS.includes(v as StepId)));
  } catch {
    return new Set();
  }
}

function writeCompletedSteps(steps: Set<StepId>): void {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...steps]));
  } catch {
    // ignore quota errors
  }
}

export function useChecklistDone(): boolean {
  const [done] = useState(() => {
    const completed = readCompletedSteps();
    return STEP_IDS.every((id) => completed.has(id));
  });
  return done;
}

type ChecklistStep = {
  id: StepId;
  icon: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
};

const STEPS: ChecklistStep[] = [
  {
    id: "create_project",
    icon: "🏗️",
    title: "最初の案件を作成",
    description: "内装工事の工事名・現場を登録します。テンプレートで工程が自動生成されます。",
    path: "/app",
    ctaLabel: "案件を作成する",
  },
  {
    id: "try_estimate",
    icon: "📝",
    title: "PDF見積を試す",
    description: "見積PDFをアップロードすると、項目を自動で読み取って積算できます。",
    path: "/estimate",
    ctaLabel: "見積ページへ",
  },
  {
    id: "upload_photo",
    icon: "📸",
    title: "現場写真をアップロード",
    description: "スマホで撮った写真を登録すると、AI分類して日報に自動反映されます。",
    path: "/today",
    ctaLabel: "写真をアップ",
  },
];

type Props = {
  /** allProjects.length > 0 になったときに非表示にするため外から渡す */
  hasProjects: boolean;
};

export function OnboardingChecklist({ hasProjects }: Props) {
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(readCompletedSteps);

  const allDone = STEP_IDS.every((id) => completedSteps.has(id));

  const markStep = useCallback((stepId: StepId) => {
    setCompletedSteps((prev) => {
      // 初回のステップ実行をファネルの「最初の実アクション」として記録
      if (prev.size === 0) trackFunnelStep("first_real_action");
      const next = new Set(prev);
      next.add(stepId);
      writeCompletedSteps(next);
      return next;
    });
  }, []);

  // 全ステップ完了 かつ 案件も存在する場合は非表示
  if (allDone && hasProjects) return null;

  const completedCount = STEP_IDS.filter((id) => completedSteps.has(id)).length;

  return (
    <section
      className="rounded-2xl border-2 border-dashed border-brand-200 bg-white px-5 py-6 shadow-sm"
      aria-label="スタートガイド"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">3ステップで始める</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {completedCount < STEP_IDS.length
              ? `${completedCount} / ${STEP_IDS.length} 完了`
              : "すべて完了しました！"}
          </p>
        </div>
        {/* Progress ring */}
        <div className="shrink-0 relative flex h-10 w-10 items-center justify-center">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              strokeDasharray={`${(completedCount / STEP_IDS.length) * 97.4} 97.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-brand-700">{completedCount}/{STEP_IDS.length}</span>
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-3" aria-label="オンボーディング手順">
        {STEPS.map((step, index) => {
          const done = completedSteps.has(step.id);
          return (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                done
                  ? "border-emerald-200 bg-emerald-50"
                  : index === completedCount
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 bg-white"
              }`}
            >
              {/* Step number / checkmark */}
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : index === completedCount
                      ? "bg-brand-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
                aria-hidden="true"
              >
                {done ? "✓" : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${done ? "text-emerald-800 line-through decoration-emerald-400" : "text-slate-800"}`}>
                  {step.icon} {step.title}
                </p>
                {!done && (
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{step.description}</p>
                )}
              </div>

              {/* CTA / done badge */}
              {done ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  完了
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    markStep(step.id);
                    navigate(step.path);
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${
                    index === completedCount
                      ? "bg-brand-600 hover:bg-brand-700"
                      : "bg-slate-400 hover:bg-slate-500"
                  }`}
                >
                  {step.ctaLabel}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {/* All done message */}
      {allDone && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            すべてのステップが完了しました。GenbaHub をお使いいただきありがとうございます！
          </p>
        </div>
      )}
    </section>
  );
}
