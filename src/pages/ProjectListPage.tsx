import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project, ProjectMode, ProjectStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { geocodeAddress } from "../infra/geocode.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { writeLastProjectId } from "../lib/last-project.js";
import { createSampleProject } from "../lib/sample-project.js";
import {
  getTemplateMajorNames,
  getTemplateIdsByMajor,
} from "../lib/phase-template-master.js";
import { expandWBSToPhases } from "../lib/work-breakdown/expansion.js";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const statusColor: Record<ProjectStatus, string> = {
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
};

type ProjectCaptureMode = "memo" | "schedule" | "record";

const modeColor: Record<ProjectMode, string> = {
  memo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  normal: "bg-indigo-50 text-indigo-700 border-indigo-200",
  full: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

function projectMode(project: Project): ProjectMode {
  return project.mode ?? "normal";
}

export function ProjectListPage() {
  const { t } = useTranslation(["pages", "common", "errors"]);
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [captureMode, setCaptureMode] = useState<ProjectCaptureMode>("memo");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sampleCreating, setSampleCreating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null);
  // Sprint 70: 工程テンプレ選択 (大項目名 Set)
  const [selectedTemplateMajors, setSelectedTemplateMajors] = useState<Set<string>>(new Set());
  const templateMajorNames = useMemo(() => getTemplateMajorNames(), []);

  const loadProjects = useCallback(async () => {
    try {
      const allProjects = await projectRepository.findAll();
      setProjects(allProjects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors:project_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [projectRepository, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト一覧の取得トリガー
    void loadProjects();
  }, [loadProjects]);

  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError(t("errors:project_name_required"));
      return false;
    }
    if (value.trim().length < 2) {
      setNameError(t("errors:project_name_too_short"));
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validateName(name)) return;

    setSubmitting(true);
    try {
      const now = new Date();
      const trimmedAddress = address.trim();
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (trimmedAddress) {
        const geocode = await geocodeAddress(trimmedAddress);
        if (geocode) {
          latitude = geocode.lat;
          longitude = geocode.lon;
        }
      }

      const projectId = crypto.randomUUID();
      const projectStartDate = startDate || toLocalDateString(now);
      const mode: ProjectMode = captureMode === "schedule" ? "normal" : "memo";
      const projectStatus = captureMode === "record" ? "completed" : status;

      await projectRepository.create({
        id: projectId,
        name: name.trim(),
        description: description.trim(),
        address: trimmedAddress || undefined,
        latitude,
        longitude,
        status: projectStatus,
        mode,
        startDate: projectStartDate,
        includeWeekends: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      // Sprint 70: 選択された大項目の工程を一括投入
      if (selectedTemplateMajors.size > 0) {
        const phases = expandWBSToPhases({
          projectId,
          projectStartDate,
          selectedMajors: selectedTemplateMajors,
          includeWeekends: true,
        });
        const nowIso = now.toISOString();
        for (const phase of phases) {
          await taskRepository.create({
            id: crypto.randomUUID(),
            createdAt: nowIso,
            updatedAt: nowIso,
            ...phase,
          });
        }
      }

      const createdName = name.trim();
      setName("");
      setDescription("");
      setAddress("");
      setStatus("planning");
      setStartDate("");
      setSelectedTemplateMajors(new Set());
      setCaptureMode("memo");
      setShowForm(false);
      setShowDetails(false);
      setCreatedProjectName(createdName);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors:create_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const openProjectGantt = (project: Project) => {
    writeLastProjectId(project.id);
    navigate(projectMode(project) === "memo" ? `/project/${project.id}` : `/gantt/${project.id}`);
  };

  const handleCreateSample = async () => {
    setSampleCreating(true);
    setError(null);
    try {
      const { projectId } = await createSampleProject(projectRepository, taskRepository);
      await loadProjects();
      navigate(`/gantt/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors:sample_create_failed"));
    } finally {
      setSampleCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label={t("common:status.loading")}>
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
        <span className="text-sm text-slate-400">{t("common:status.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[linear-gradient(145deg,#fffaf2_0%,#f6fbff_56%,#eff6ff_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">{t("pages:project_list.section_label")}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{t("pages:project_list.title")}</h1>
            <p className="mt-2 text-sm text-slate-500">{t("pages:project_list.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="ios-btn-primary px-5 py-3 text-sm"
          >
            {showForm ? t("pages:project_list.close_form") : t("pages:project_list.create_button")}
          </button>
        </div>
      </section>

      {createdProjectName ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="font-semibold">
            {t("pages:project_list.created_banner_title", { name: createdProjectName })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreatedProjectName(null);
                navigate("/estimate");
              }}
              className="ios-btn-primary px-4 py-2 text-xs"
            >
              {t("pages:project_list.created_banner_cta")}
            </button>
            <button
              type="button"
              onClick={() => setCreatedProjectName(null)}
              aria-label={t("common:actions.close")}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF]">+</span>
            <h2 className="text-lg font-bold text-slate-900">{t("pages:project_list.create_title")}</h2>
          </div>

          {error ? (
            <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <legend className="px-1 text-sm font-medium text-slate-700">{t("pages:project_list.capture_mode_label")}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("memo");
                    if (status === "completed") setStatus("planning");
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                    captureMode === "memo"
                      ? "border-[#007AFF] bg-white text-slate-900 ring-2 ring-[#007AFF]/15"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="block font-semibold">{t("pages:project_list.capture_mode_memo")}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {t("pages:project_list.capture_mode_memo_desc")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("schedule");
                    if (status === "completed") setStatus("planning");
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                    captureMode === "schedule"
                      ? "border-[#007AFF] bg-white text-slate-900 ring-2 ring-[#007AFF]/15"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="block font-semibold">{t("pages:project_list.capture_mode_schedule")}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {t("pages:project_list.capture_mode_schedule_desc")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("record");
                    setStatus("completed");
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                    captureMode === "record"
                      ? "border-[#007AFF] bg-white text-slate-900 ring-2 ring-[#007AFF]/15"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="block font-semibold">{t("pages:project_list.capture_mode_record")}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {t("pages:project_list.capture_mode_record_desc")}
                  </span>
                </button>
              </div>
            </fieldset>

            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-slate-700">
                {t("pages:project_list.project_name_label")} <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) validateName(event.target.value);
                }}
                onBlur={() => {
                  if (name) validateName(name);
                }}
                placeholder={t("pages:project_list.project_name_placeholder")}
                className={`mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 ${
                  nameError ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {nameError ? <p className="mt-1.5 text-xs text-red-600">{nameError}</p> : null}
            </div>

            {/* 詳細設定トグル */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#007AFF]"
            >
              <span
                className={`inline-block transition-transform duration-150 ${showDetails ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                ›
              </span>
              {showDetails ? "詳細を閉じる" : "詳細を設定する（住所・開始日・工程テンプレ）"}
            </button>

            {showDetails ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-slate-700">
                    {t("pages:project_list.description_label")}
                  </label>
                  <input
                    id="project-description"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t("pages:project_list.description_placeholder")}
                    className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                  />
                </div>

                <div>
                  <label htmlFor="project-address" className="block text-sm font-medium text-slate-700">
                    {t("pages:project_list.address_label")}
                  </label>
                  <input
                    id="project-address"
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder={t("pages:project_list.address_placeholder")}
                    className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="project-status" className="block text-sm font-medium text-slate-700">
                      {t("pages:project_list.status_label")}
                    </label>
                    <select
                      id="project-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                      className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                    >
                      <option value="planning">{t("common:status.planning")}</option>
                      <option value="active">{t("common:status.active")}</option>
                      <option value="completed">{t("common:status.completed")}</option>
                      <option value="on_hold">{t("common:status.on_hold")}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="project-start-date" className="block text-sm font-medium text-slate-700">
                      {t("pages:project_list.start_date_label")}
                    </label>
                    <input
                      id="project-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                    />
                  </div>
                </div>

                {/* Sprint 70: 工程テンプレライブラリ選択 */}
                <div>
                  <p className="block text-sm font-medium text-slate-700">
                    工程テンプレ（任意）
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">選択した大項目の工程を作成後に一括投入します</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    {templateMajorNames.map((majorName) => {
                      const checked = selectedTemplateMajors.has(majorName);
                      return (
                        <label
                          key={majorName}
                          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedTemplateMajors((prev) => {
                                const next = new Set(prev);
                                if (next.has(majorName)) {
                                  next.delete(majorName);
                                } else {
                                  next.add(majorName);
                                }
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]/30"
                          />
                          {majorName}
                        </label>
                      );
                    })}
                  </div>
                  {selectedTemplateMajors.size > 0 && (
                    <p className="mt-2 text-xs text-[#007AFF]">
                      {selectedTemplateMajors.size}大項目 /{" "}
                      {[...selectedTemplateMajors]
                        .flatMap((m) => getTemplateIdsByMajor(m))
                        .length}
                      工程エントリを投入予定
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="ios-btn-primary px-5 py-3 text-sm disabled:opacity-60"
              >
                {submitting ? t("pages:project_list.submitting") : t("pages:project_list.submit_button")}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setShowDetails(false); }}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                {t("common:actions.cancel")}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {projects.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-4xl">
            🏗️
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t("pages:project_list.empty_title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            {t("pages:project_list.empty_desc")}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void handleCreateSample()}
              disabled={sampleCreating}
              className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
            >
              {sampleCreating ? t("pages:project_list.sample_creating") : t("common:actions.create_sample")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="ios-btn-primary px-5 py-3 text-sm"
            >
              {t("common:actions.create_self")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/estimate")}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600"
            >
              {t("pages:project_list.empty_estimate_only")}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t("common:messages.sample_deletable")}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProjectGantt(project)}
              className="rounded-[26px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-slate-200 transition-transform active:scale-[0.99] sm:px-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{project.name}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColor[project.status]}`}>
                      {t(`common:status.${project.status}`)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${modeColor[projectMode(project)]}`}>
                      {t(`pages:project_list.mode.${projectMode(project)}`)}
                    </span>
                  </div>
                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">{project.description}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {projectMode(project) === "memo" ? t("pages:project_list.open_record") : t("pages:project_list.open_gantt")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>{project.address ?? t("common:labels.unset")}</span>
                <span>{project.startDate}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
