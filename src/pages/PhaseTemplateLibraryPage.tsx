/**
 * 工程テンプレートライブラリページ
 *
 * Sprint 70: テンプレートの一覧・プレビュー・プロジェクト適用
 */

import { useCallback, useEffect, useState } from "react";
import {
  listPhaseTemplates,
  deletePhaseTemplate,
} from "../lib/phase-template/storage.js";
import type { PhaseTemplate, PhaseTemplateTag } from "../lib/phase-template/types.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import type { Project } from "../domain/types.js";
import { ConfirmDialog } from "../components/common/ConfirmDialog.js";

// ─── タグカラー ───────────────────────────────────────────────────────────────

const TAG_STYLE: Record<PhaseTemplateTag, string> = {
  住宅: "bg-blue-50 text-blue-700 ring-blue-200",
  店舗: "bg-amber-50 text-amber-700 ring-amber-200",
  オフィス: "bg-brand-50 text-brand-700 ring-brand-200",
};

// ─── テンプレートカード ───────────────────────────────────────────────────────

type TemplateCardProps = {
  template: PhaseTemplate;
  onPreview: (template: PhaseTemplate) => void;
  onApply: (template: PhaseTemplate) => void;
  onDelete: (template: PhaseTemplate) => void;
};

function TemplateCard({ template, onPreview, onApply, onDelete }: TemplateCardProps) {
  const totalCategories = template.phases.length;
  const totalTasks = template.phases.reduce(
    (sum, cat) =>
      sum + cat.groups.reduce((s, g) => s + (g.tasks.length > 0 ? g.tasks.length : 1), 0),
    0,
  );

  return (
    <article
      className="rounded-cozy bg-white shadow-cozy-sm ring-1 ring-slate-200 p-5 flex flex-col gap-3"
      aria-label={template.name}
    >
      <div>
        <h2 className="text-base font-bold text-slate-900 leading-snug">{template.name}</h2>
        {template.description && (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{template.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${TAG_STYLE[tag]}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        {totalCategories} 大項目 / {totalTasks} タスク
      </p>

      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        <button
          type="button"
          onClick={() => onPreview(template)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
        >
          プレビュー
        </button>
        <button
          type="button"
          onClick={() => onApply(template)}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
        >
          適用
        </button>
        <button
          type="button"
          onClick={() => onDelete(template)}
          aria-label={`${template.name}を削除`}
          className="ml-auto rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
        >
          削除
        </button>
      </div>
    </article>
  );
}

// ─── 3階層ツリープレビュー ────────────────────────────────────────────────────

type PhaseTreePreviewProps = {
  template: PhaseTemplate;
  onClose: () => void;
};

function PhaseTreePreview({ template, onClose }: PhaseTreePreviewProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="rounded-cozy bg-white shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 id="preview-title" className="text-base font-bold text-slate-900">{template.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">工程ツリープレビュー</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {template.phases.map((cat) => (
            <div key={cat.id} className="mb-4">
              <h3 className="text-sm font-bold text-slate-800 mb-1.5">{cat.name}</h3>
              <div className="pl-3 space-y-1">
                {cat.groups.map((group) => (
                  <div key={group.id}>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">{group.name}</p>
                    {group.tasks.length > 0 && (
                      <ul className="pl-3 space-y-0.5">
                        {group.tasks.map((task) => (
                          <li key={task.id} className="text-xs text-slate-500">
                            {task.name}
                            <span className="ml-1 text-slate-400">({task.defaultDays}日)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 適用モーダル ─────────────────────────────────────────────────────────────

type ApplyModalProps = {
  template: PhaseTemplate;
  projects: Project[];
  onApply: (projectId: string) => Promise<void>;
  onClose: () => void;
  applying: boolean;
  applyError: string | null;
};

function ApplyModal({ template, projects, onApply, onClose, applying, applyError }: ApplyModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="rounded-cozy bg-white shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="工程テンプレート適用"
      >
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">テンプレートを適用</h2>
          <p className="text-xs text-slate-500 mt-1">「{template.name}」を適用する案件を選択してください。</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">案件がありません。先に案件を作成してください。</p>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="適用先案件"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {applyError && (
            <p className="text-xs text-red-600 font-medium" role="alert">{applyError}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={applying || !selectedProjectId}
            onClick={() => void onApply(selectedProjectId)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            {applying ? "適用中..." : "適用"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

export function PhaseTemplateLibraryPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = createProjectRepository(() => organizationId);
  const taskRepository = createTaskRepository(() => organizationId);

  const [templates, setTemplates] = useState<PhaseTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PhaseTemplate | null>(null);
  const [applyTarget, setApplyTarget] = useState<PhaseTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhaseTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setTemplates(listPhaseTemplates());
  }, []);

  useEffect(() => {
    refresh();
    setLoadingProjects(true);
    projectRepository
      .findAll()
      .then((all) => {
        setProjects(all);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        setLoadingProjects(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = useCallback(
    () => {
      if (!deleteTarget) return;
      deletePhaseTemplate(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    },
    [deleteTarget, refresh],
  );

  const handleApply = useCallback(
    async (projectId: string) => {
      if (!applyTarget) return;
      setApplyError(null);
      setApplying(true);
      try {
        const now = new Date().toISOString();
        for (const cat of applyTarget.phases) {
          for (const group of cat.groups) {
            if (group.tasks.length > 0) {
              for (const task of group.tasks) {
                await taskRepository.create({
                  id: crypto.randomUUID(),
                  projectId,
                  name: task.name,
                  description: "",
                  status: "todo",
                  progress: 0,
                  dependencies: [],
                  majorCategory: cat.name,
                  middleCategory: group.name,
                  minorCategory: task.name,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            } else {
              await taskRepository.create({
                id: crypto.randomUUID(),
                projectId,
                name: group.name,
                description: "",
                status: "todo",
                progress: 0,
                dependencies: [],
                majorCategory: cat.name,
                middleCategory: group.name,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
        setApplyTarget(null);
        navigate(`/gantt/${projectId}`);
      } catch (err) {
        setApplyError(err instanceof Error ? err.message : "適用に失敗しました");
      } finally {
        setApplying(false);
      }
    },
    [applyTarget, taskRepository],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="工程テンプレートを削除"
        message={
          <>
            <span className="font-semibold text-slate-800">{deleteTarget?.name}</span>
            を削除します。この操作は取り消せません。
          </>
        }
        confirmLabel="削除する"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">工程テンプレートライブラリ</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            保存済みの工程テンプレートを一覧表示・適用できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/gantt")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
        >
          工程表へ
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-cozy border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">テンプレートがありません</p>
          <p className="mt-1 text-xs text-slate-400">
            工程表画面で「テンプレ保存」ボタンを押すと、工程をテンプレートとして保存できます。
          </p>
          <button
            type="button"
            onClick={() => navigate("/gantt")}
            className="mt-4 rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            工程表を開く
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="テンプレート一覧"
        >
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onPreview={setPreviewTemplate}
              onApply={(t) => {
                setApplyError(null);
                setApplyTarget(t);
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {!loadingProjects && previewTemplate && (
        <PhaseTreePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {!loadingProjects && applyTarget && (
        <ApplyModal
          template={applyTarget}
          projects={projects}
          onApply={handleApply}
          onClose={() => setApplyTarget(null)}
          applying={applying}
          applyError={applyError}
        />
      )}
    </div>
  );
}
