import { navigate } from "../hooks/useHashRouter.js";

type ProjectDetailTabsProps = {
  projectId: string;
  activeTab: "overview" | "documents" | "chat" | "finance" | "contract";
};

export function ProjectDetailTabs({ projectId, activeTab }: ProjectDetailTabsProps) {
  const encodedProjectId = encodeURIComponent(projectId);

  return (
    <nav
      aria-label="案件ナビゲーション"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      <button
        type="button"
        aria-current={activeTab === "overview" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}`)}
        className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
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
        className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "documents"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        ドキュメント
      </button>
      <button
        type="button"
        aria-current={activeTab === "chat" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}/chat`)}
        className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "chat"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        チャット
      </button>
      <button
        type="button"
        aria-current={activeTab === "finance" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}/finance`)}
        className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "finance"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        収支
      </button>
      <button
        type="button"
        aria-current={activeTab === "contract" ? "page" : undefined}
        onClick={() => navigate(`/project/${encodedProjectId}/contract`)}
        className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
          activeTab === "contract"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        契約
      </button>
    </nav>
  );
}
