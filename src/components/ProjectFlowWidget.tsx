import { useState } from "react";
import {
  STAGE_ORDER,
  getStageLabel,
  getStageDescription,
  calculateOverallProgress,
  calculateStageCompletion,
  canAdvanceStage,
  getStageIndex,
} from "../lib/project-flow.js";
import type { ProjectStage, StageProgress } from "../lib/project-flow.js";

type Props = {
  currentStage: ProjectStage;
  stageProgresses: StageProgress[];
  onChecklistToggle?: (stage: ProjectStage, itemId: string) => void;
};

const STAGE_ICONS: Record<string, string> = {
  inquiry: "📋",
  siteVisit: "🏠",
  specification: "📝",
  productSelect: "🔢",
  drawing: "📐",
  pricing: "💴",
  contract: "🤝",
  construction: "🔨",
  completed: "✅",
};

function StageStatusBadge({ status }: { status: StageProgress["status"] }) {
  const config: Record<string, { label: string; className: string }> = {
    notStarted: { label: "未着手", className: "bg-slate-100 text-slate-500" },
    inProgress: { label: "進行中", className: "bg-orange-100 text-orange-600" },
    completed: { label: "完了", className: "bg-emerald-100 text-emerald-700" },
    blocked: { label: "ブロック", className: "bg-red-100 text-red-600" },
  };
  const { label, className } = config[status] ?? config.notStarted;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

export function ProjectFlowWidget({
  currentStage,
  stageProgresses,
  onChecklistToggle,
}: Props) {
  const [expandedStage, setExpandedStage] = useState<ProjectStage | null>(currentStage);

  const overallProgress = calculateOverallProgress(stageProgresses);
  const progressPct = Math.round(overallProgress * 100);

  const progressByStage = Object.fromEntries(
    stageProgresses.map((p) => [p.stage, p]),
  ) as Record<ProjectStage, StageProgress>;

  const currentStageProgress = progressByStage[currentStage];
  const canAdvance = currentStageProgress ? canAdvanceStage(currentStageProgress.checklist) : false;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">プロジェクトフロー</h2>
          <p className="text-xs text-slate-500">
            現在: {getStageLabel(currentStage)} · {progressPct}% 完了
          </p>
        </div>
        {canAdvance && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            次のステージへ進める
          </span>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-0.5">
          {STAGE_ORDER.map((stage) => {
            const p = progressByStage[stage];
            const isCompleted = p?.status === "completed";
            const isCurrent = stage === currentStage;
            const isInProgress = p?.status === "inProgress";
            return (
              <div
                key={stage}
                className={`h-2 flex-1 rounded-sm transition-colors ${
                  isCompleted
                    ? "bg-emerald-500"
                    : isCurrent || isInProgress
                      ? "bg-orange-400"
                      : "bg-slate-200"
                }`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>依頼</span>
          <span>{progressPct}%</span>
          <span>完工</span>
        </div>
      </div>

      {/* Stage list — mobile: vertical, desktop: vertical scrollable */}
      <div className="flex flex-col gap-1 px-2 pb-2 md:max-h-96 md:overflow-y-auto">
        {STAGE_ORDER.map((stage, index) => {
          const p = progressByStage[stage];
          if (!p) return null;

          const isCurrent = stage === currentStage;
          const isCompleted = p.status === "completed";
          const isExpanded = expandedStage === stage;
          const completionPct = Math.round(calculateStageCompletion(p.checklist) * 100);

          return (
            <div
              key={stage}
              className={`rounded-lg border transition-colors ${
                isCurrent
                  ? "border-orange-200 bg-orange-50"
                  : isCompleted
                    ? "border-emerald-100 bg-emerald-50/40"
                    : "border-transparent hover:border-slate-100"
              }`}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                onClick={() =>
                  setExpandedStage((prev) => (prev === stage ? null : stage))
                }
              >
                {/* Step number / check */}
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-orange-400 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>

                {/* Icon + label */}
                <span className="text-base leading-none">
                  {STAGE_ICONS[stage]}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-semibold ${
                      isCurrent
                        ? "text-orange-700"
                        : isCompleted
                          ? "text-emerald-700"
                          : "text-slate-600"
                    }`}
                  >
                    {getStageLabel(stage)}
                  </span>
                  {isCurrent && (
                    <p className="text-xs text-slate-400 truncate">
                      {getStageDescription(stage)}
                    </p>
                  )}
                </div>

                {/* Right side info */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isCompleted && p.status !== "notStarted" && (
                    <span className="text-xs text-slate-400">{completionPct}%</span>
                  )}
                  <StageStatusBadge status={p.status} />
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {/* Checklist */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    チェックリスト
                  </p>
                  <ul className="space-y-1.5">
                    {p.checklist.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => onChecklistToggle?.(stage, item.id)}
                        >
                          <span
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs ${
                              item.completed
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : item.required
                                  ? "border-orange-400 bg-white"
                                  : "border-slate-300 bg-white"
                            }`}
                          >
                            {item.completed && "✓"}
                          </span>
                          <span
                            className={`flex-1 text-sm ${
                              item.completed
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.required && !item.completed && (
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-bold text-orange-600">
                              必須
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
