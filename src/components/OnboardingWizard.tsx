import { useState, useCallback } from "react";
import { navigate } from "../hooks/useHashRouter.js";
import { createProjectRepository } from "../stores/project-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

const ONBOARDING_KEY = "genbahub_onboarding_done";

export function useOnboardingDone(): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "1";
    } catch {
      return false;
    }
  });

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setDone(true);
  }, []);

  return [done, markDone];
}

type Template = {
  id: string;
  label: string;
  icon: string;
  tasks: string[];
};

const TEMPLATES: Template[] = [
  {
    id: "interior",
    label: "内装工事",
    icon: "🏠",
    tasks: ["解体・撤去", "下地工事", "電気・設備工事", "内装仕上げ", "清掃・検査"],
  },
  {
    id: "exterior",
    label: "外構工事",
    icon: "🌿",
    tasks: ["測量・設計", "土工事", "基礎工事", "舗装・植栽", "仕上げ・検査"],
  },
  {
    id: "equipment",
    label: "設備工事",
    icon: "⚙️",
    tasks: ["既存設備撤去", "配管工事", "機器設置", "試運転・調整", "完成検査"],
  },
];

type Step = 1 | 2 | 3 | 4;

type Props = {
  onComplete: () => void;
};

export function OnboardingWizard({ onComplete }: Props) {
  const { organizationId } = useOrganizationContext();
  const [step, setStep] = useState<Step>(1);
  const [projectName, setProjectName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const handleSkip = () => {
    onComplete();
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const handleStep1Next = () => {
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!projectName.trim()) {
      setNameError("プロジェクト名を入力してください");
      return;
    }
    if (projectName.trim().length < 2) {
      setNameError("プロジェクト名は2文字以上で入力してください");
      return;
    }
    setNameError(null);
    setStep(3);
  };

  const handleStep3Next = async () => {
    if (!selectedTemplate) return;

    setCreating(true);
    try {
      const repo = createProjectRepository(() => organizationId);
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const startDate = `${y}-${m}-${d}`;

      const projectId = crypto.randomUUID();
      await repo.create({
        id: projectId,
        name: projectName.trim(),
        description: projectAddress.trim() ? `現場: ${projectAddress.trim()}` : "",
        status: "planning",
        startDate,
        includeWeekends: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...(projectAddress.trim() ? { address: projectAddress.trim() } : {}),
      });
      setCreatedProjectId(projectId);
      setStep(4);
    } catch {
      // even on error, proceed
      setStep(4);
    } finally {
      setCreating(false);
    }
  };

  const handleFinish = () => {
    onComplete();
    if (createdProjectId) {
      navigate(`/project/${createdProjectId}`);
    } else {
      navigate("/gantt");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="初回セットアップウィザード"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Step indicator */}
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">
            ステップ {step} / 4
          </p>

          {step === 1 && <Step1 />}
          {step === 2 && (
            <Step2
              projectName={projectName}
              setProjectName={setProjectName}
              projectAddress={projectAddress}
              setProjectAddress={setProjectAddress}
              nameError={nameError}
              setNameError={setNameError}
            />
          )}
          {step === 3 && (
            <Step3
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
            />
          )}
          {step === 4 && <Step4 />}

          {/* Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {step > 1 && step < 4 && (
                <button
                  onClick={handleBack}
                  className="h-[60px] rounded-xl border border-slate-200 px-6 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  戻る
                </button>
              )}
              {step < 4 && (
                <button
                  onClick={handleSkip}
                  className="h-[60px] rounded-xl px-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  スキップ
                </button>
              )}
            </div>

            <div>
              {step === 1 && (
                <button
                  onClick={handleStep1Next}
                  className="h-[60px] w-full sm:w-auto rounded-xl bg-brand-500 px-8 text-base font-bold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
                >
                  はじめる →
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleStep2Next}
                  className="h-[60px] w-full sm:w-auto rounded-xl bg-brand-500 px-8 text-base font-bold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
                >
                  次へ →
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={() => void handleStep3Next()}
                  disabled={!selectedTemplate || creating}
                  className="h-[60px] w-full sm:w-auto rounded-xl bg-brand-500 px-8 text-base font-bold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      作成中...
                    </span>
                  ) : (
                    "作成する →"
                  )}
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={handleFinish}
                  className="h-[60px] w-full sm:w-auto rounded-xl bg-brand-500 px-8 text-base font-bold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
                >
                  工程表を開く →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────── */

function Step1() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-50 text-5xl">
        🏗️
      </div>
      <h2 className="text-2xl font-bold text-slate-900">
        GenbaHubへようこそ！
      </h2>
      <p className="mt-4 text-base text-slate-600 leading-relaxed">
        建設・内装工事の現場管理をかんたんに。
        <br />
        工程表の作成から業者管理まで、
        <br />
        このアプリ1つで完結します。
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <FeatureBadge icon="📊" label="工程表" />
        <FeatureBadge icon="🏢" label="業者管理" />
        <FeatureBadge icon="📋" label="今日の作業" />
      </div>
    </div>
  );
}

function FeatureBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rounded-xl bg-brand-50 p-3">
      <div className="text-2xl">{icon}</div>
      <p className="mt-1 text-xs font-semibold text-brand-700">{label}</p>
    </div>
  );
}

type Step2Props = {
  projectName: string;
  setProjectName: (v: string) => void;
  projectAddress: string;
  setProjectAddress: (v: string) => void;
  nameError: string | null;
  setNameError: (v: string | null) => void;
};

function Step2({
  projectName,
  setProjectName,
  projectAddress,
  setProjectAddress,
  nameError,
  setNameError,
}: Step2Props) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl">📝</span>
        <div>
          <h2 className="text-xl font-bold text-slate-900">最初のプロジェクトを作ろう</h2>
          <p className="mt-1 text-sm text-slate-500">
            現在進行中の工事を1つ登録してください
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="onboarding-project-name" className="block text-sm font-semibold text-slate-700">
            工事名 <span className="text-red-500">*</span>
          </label>
          <input
            id="onboarding-project-name"
            type="text"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              if (nameError) setNameError(null);
            }}
            maxLength={200}
            autoComplete="off"
            autoFocus
            placeholder="例: 渋谷オフィスビル内装工事"
            className={`mt-1.5 block w-full rounded-xl border px-4 py-3.5 text-base shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none ${
              nameError ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
            }`}
          />
          {nameError && (
            <p className="mt-1.5 text-xs text-red-600">{nameError}</p>
          )}
        </div>
        <div>
          <label htmlFor="onboarding-project-address" className="block text-sm font-semibold text-slate-700">
            現場住所
            <span className="ml-1 text-xs font-normal text-slate-400">（任意）</span>
          </label>
          <input
            id="onboarding-project-address"
            type="text"
            value={projectAddress}
            onChange={(e) => setProjectAddress(e.target.value)}
            maxLength={300}
            autoComplete="street-address"
            placeholder="例: 東京都港区南青山3-1-1"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">天気予報の取得に使用します</p>
        </div>
      </div>
    </div>
  );
}

type Step3Props = {
  selectedTemplate: string | null;
  setSelectedTemplate: (v: string) => void;
};

function Step3({ selectedTemplate, setSelectedTemplate }: Step3Props) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl">📊</span>
        <div>
          <h2 className="text-xl font-bold text-slate-900">工程表を作ろう</h2>
          <p className="mt-1 text-sm text-slate-500">
            工事の種類を選ぶと工程が自動で入ります
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setSelectedTemplate(tpl.id)}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              selectedTemplate === tpl.id
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{tpl.label}</p>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {tpl.tasks.join(" → ")}
                </p>
              </div>
              {selectedTemplate === tpl.id && (
                <span className="shrink-0 text-brand-500 text-xl">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>
      {!selectedTemplate && (
        <p className="mt-3 text-xs text-slate-400 text-center">
          テンプレートを選択してください
        </p>
      )}
    </div>
  );
}

function Step4() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-50 text-5xl">
        🎉
      </div>
      <h2 className="text-2xl font-bold text-slate-900">準備完了！</h2>
      <p className="mt-4 text-base text-slate-600 leading-relaxed">
        プロジェクトが作成されました。
        <br />
        工程表からタスクを追加して、
        <br />
        現場管理をはじめましょう。
      </p>
      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">次にやること</p>
        <NextStep num={1} text="工程表でタスクを追加する" />
        <NextStep num={2} text="業者を登録する" />
        <NextStep num={3} text="今日のタスクを確認する" />
      </div>
    </div>
  );
}

function NextStep({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
        {num}
      </span>
      <span className="text-sm text-slate-700">{text}</span>
    </div>
  );
}
