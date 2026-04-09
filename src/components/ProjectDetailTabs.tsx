import { navigate } from "../hooks/useHashRouter.js";

type ProjectDetailTabsProps = {
  projectId: string;
  activeTab: "overview" | "documents";
};

export function ProjectDetailTabs({ projectId, activeTab }: ProjectDetailTabsProps) {
  const encodedProjectId = encodeURIComponent(projectId);

  return (
    <nav
      aria-label="プロジェクトナビゲーション"
      className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      <button
        type="button"
        aria-current={activeTab === "overview" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}`)}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "overview"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        概要
      </button>
      <button
        type="button"
        aria-current={activeTab === "documents" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}/documents`)}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "documents"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        ドキュメント
      </button>
    </nav>
  );
}
