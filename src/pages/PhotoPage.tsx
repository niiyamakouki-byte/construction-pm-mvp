import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { PhotoGrid } from "../components/PhotoGrid.js";
import { EmptyState } from "../components/EmptyState.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import type { Project } from "../domain/types.js";
import { navigate } from "../hooks/useHashRouter.js";
import type { PhotoMetadata } from "../lib/photo-organizer.js";
import { getCategoryLabel, PhotoCategory } from "../lib/photo-upload.js";
import { buildPhotoLedgerHtml } from "../lib/photo-ledger.js";
import type { PhotoCategory as LedgerPhotoCategory } from "../lib/photo-classifier.js";
import type { UploadedPhoto } from "../infra/supabase-adapter/photo-repository.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createPhotoStore } from "../stores/photo-store.js";

function toPhotoMetadata(photo: UploadedPhoto): PhotoMetadata {
  const category = Object.values(PhotoCategory).includes(photo.category as PhotoCategory)
    ? getCategoryLabel(photo.category as PhotoCategory)
    : photo.category;
  return {
    id: photo.id,
    url: photo.url,
    projectId: photo.projectId,
    capturedAt: photo.takenAt,
    description: photo.caption || photo.fileName,
    tags: category ? [category] : [],
  };
}

function PhotoEmptyState({ hasProjects }: { hasProjects: boolean }) {
  return (
    <EmptyState
      icon={<Camera size={22} strokeWidth={1.75} />}
      title="現場写真はまだありません"
      description="今日の現場でスマホ撮影 → アップロードすると、案件ごとの写真台帳に自動整理されます。"
      actionLabel={hasProjects ? "今日の写真をアップロード" : "案件を登録する"}
      onAction={() => navigate(hasProjects ? "/today" : "/app")}
    />
  );
}

type Tab = "photos" | "ledger";

export function PhotoPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const photoStore = useMemo(() => createPhotoStore(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [rawPhotos, setRawPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("photos");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const loadProjects = useCallback(async () => {
    const all = await projectRepository.findAll();
    setProjects(all);
    setSelectedProjectId((prev) => (prev === "" && all[0] ? all[0].id : prev));
  }, [projectRepository]);

  const loadPhotos = useCallback(async (projectId: string) => {
    if (!projectId) {
      setPhotos([]);
      setRawPhotos([]);
      return;
    }
    const saved = await photoStore.listPhotosByProject(projectId);
    setRawPhotos(saved);
    setPhotos(saved.map(toPhotoMetadata));
  }, [photoStore]);

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示時に案件一覧を取得する意図的な同期
    void loadProjects()
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : "案件の取得に失敗しました");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 案件選択に応じて保存済み写真を取得する意図的な同期
      void loadPhotos(selectedProjectId).catch((err) => {
        setError(err instanceof Error ? err.message : "写真の取得に失敗しました");
      });
    }
  }, [loadPhotos, selectedProjectId]);

  function handleOpenLedger() {
    if (!selectedProject) return;
    const html = buildPhotoLedgerHtml({
      cover: {
        projectName: selectedProject.name,
        startDate: selectedProject.startDate,
        endDate: selectedProject.endDate ?? undefined,
        location: selectedProject.address ?? undefined,
      },
      entries: rawPhotos.map((p) => ({
        photoUrl: p.url,
        shootDate: p.takenAt.slice(0, 10),
        // ponytail: cast to ledger category; non-matching strings fall to "other"
        category: (p.category as LedgerPhotoCategory | undefined) ?? "other",
        comment: p.caption,
        fileName: p.fileName,
      })),
      layout: 4,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] pb-28">
      {/* ヘッダー行: タイトル + 案件選択 */}
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3437]">現場写真</h1>
          <p className="mt-1 text-sm text-[#787774]">案件ごとの写真を管理します。</p>
        </div>
        <label className="block text-xs font-semibold text-[#787774]">
          案件
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="mt-1 block min-w-64 rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#2F3437] focus:border-[#346538] focus:outline-none focus:ring-2 focus:ring-[#346538]/20"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* タブ */}
      <div className="flex gap-0 border-b border-[#EAEAEA]">
        {(["photos", "ledger"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[#346538] text-[#346538]"
                : "text-[#787774] hover:text-[#2F3437]"
            }`}
          >
            {tab === "photos" ? "写真一覧" : "台帳"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#787774]">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#346538]/30 border-t-[#346538]" />
          読み込み中...
        </div>
      ) : activeTab === "photos" ? (
        <div className="mt-4">
          {photos.length === 0 ? (
            <PhotoEmptyState hasProjects={projects.length > 0} />
          ) : (
            <PhotoGrid photos={photos} />
          )}
        </div>
      ) : (
        /* 台帳タブ */
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-[#EAEAEA] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#787774]">写真台帳</p>
            <h2 className="mt-1 text-lg font-bold text-[#2F3437]">{selectedProject?.name ?? "—"}</h2>
            {selectedProject?.startDate ? (
              <p className="mt-1 text-sm text-[#787774]">
                {selectedProject.startDate}
                {selectedProject.endDate ? ` 〜 ${selectedProject.endDate}` : ""}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-[#787774]">
              写真 {rawPhotos.length} 枚 · 国交省デジタル写真管理情報基準（CALS/EC）対応
            </p>
            <button
              type="button"
              disabled={rawPhotos.length === 0}
              onClick={handleOpenLedger}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              PDFプレビュー（印刷用）
            </button>
            {rawPhotos.length === 0 ? (
              <p className="mt-2 text-xs text-[#787774]">写真が1枚以上必要です。</p>
            ) : null}
          </div>

          <p className="text-xs text-[#787774]">
            ブラウザの印刷ダイアログから PDF に保存できます。
          </p>
        </div>
      )}

      {/* 固定CTA: 撮影・追加 */}
      <div className="fixed bottom-6 right-6 z-20">
        <button
          type="button"
          onClick={() => navigate("/today")}
          className="flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#333] active:scale-[0.97]"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          撮影・追加
        </button>
      </div>
    </div>
  );
}
