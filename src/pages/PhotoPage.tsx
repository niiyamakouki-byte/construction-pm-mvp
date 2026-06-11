import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { PhotoGrid } from "../components/PhotoGrid.js";
import { EmptyState } from "../components/EmptyState.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import type { Project } from "../domain/types.js";
import { navigate } from "../hooks/useHashRouter.js";
import type { PhotoMetadata } from "../lib/photo-organizer.js";
import { getCategoryLabel, PhotoCategory } from "../lib/photo-upload.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createPhotoStore } from "../stores/photo-store.js";

function toPhotoMetadata(photo: {
  id: string;
  url: string;
  projectId: string;
  fileName: string;
  category?: string;
  caption?: string;
  takenAt: string;
}): PhotoMetadata {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const all = await projectRepository.findAll();
    setProjects(all);
    if (!selectedProjectId && all[0]) {
      setSelectedProjectId(all[0].id);
    }
  }, [projectRepository, selectedProjectId]);

  const loadPhotos = useCallback(async (projectId: string) => {
    if (!projectId) {
      setPhotos([]);
      return;
    }
    const saved = await photoStore.listPhotosByProject(projectId);
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

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">現場写真</h1>
          <p className="mt-1 text-sm text-slate-500">保存済み写真を表示します。</p>
        </div>
        <label className="block text-xs font-semibold text-slate-500">
          案件
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="mt-1 block min-w-64 rounded-xl border border-slate-200 backdrop-blur-sm bg-white/80 px-3 py-2 text-sm text-slate-700 focus:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
          読み込み中...
        </div>
      ) : photos.length === 0 ? (
        <PhotoEmptyState hasProjects={projects.length > 0} />
      ) : (
        <PhotoGrid photos={photos} />
      )}
    </div>
  );
}
