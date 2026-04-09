import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import type { Project } from "../domain/types.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createProjectRepository } from "../stores/project-store.js";
import { ProjectDetailTabs } from "./ProjectDetailTabs.js";

type DocumentType = "drawing" | "contract" | "permit" | "daily_report" | "photo" | "invoice" | "other";

type ProjectDocument = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};

type DocumentVersion = {
  id: string;
  createdAt: string;
  updatedAt: string;
  documentId: string;
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};

type PreviewConfig =
  | { mode: "image"; src: string }
  | { mode: "iframe"; src: string }
  | null;

const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: "drawing", label: "図面" },
  { value: "contract", label: "契約" },
  { value: "permit", label: "許可" },
  { value: "photo", label: "写真" },
  { value: "invoice", label: "請求書" },
  { value: "daily_report", label: "レポート" },
];

const documentTypeLabels: Record<DocumentType, string> = {
  drawing: "図面",
  contract: "契約",
  permit: "許可",
  daily_report: "レポート",
  photo: "写真",
  invoice: "請求書",
  other: "その他",
};

function sortByNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function formatDocumentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGooglePreviewUrl(url: string): string | null {
  const driveFileMatch = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  const docsMatch = url.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
  if (docsMatch) {
    return `https://docs.google.com/${docsMatch[1]}/d/${docsMatch[2]}/preview`;
  }

  return null;
}

function getPreviewConfig(url: string): PreviewConfig {
  const googlePreviewUrl = getGooglePreviewUrl(url);
  if (googlePreviewUrl) {
    return { mode: "iframe", src: googlePreviewUrl };
  }

  const normalizedUrl = url.toLowerCase().split("?")[0] ?? "";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(normalizedUrl)) {
    return { mode: "image", src: url };
  }

  if (normalizedUrl.endsWith(".pdf")) {
    return { mode: "iframe", src: url };
  }

  return null;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | { error?: string; document?: unknown; documents?: unknown; versions?: unknown }
    | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "ドキュメントAPIの呼び出しに失敗しました。");
  }

  return data as T;
}

export function DocumentsPage({ projectId }: { projectId: string }) {
  const { organizationId } = useOrganizationContext();
  const { user } = useAuth();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<DocumentType>("drawing");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projectData, response] = await Promise.all([
          projectRepository.findById(projectId),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/documents`),
        ]);
        const data = await parseApiResponse<{ documents: ProjectDocument[] }>(response);

        if (cancelled) {
          return;
        }

        setProject(projectData);
        setDocuments(sortByNewest(data.documents));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "ドキュメント一覧の読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [projectId, projectRepository]);

  useEffect(() => {
    if (selectedDocumentId && !documents.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(null);
      setVersions([]);
    }
  }, [documents, selectedDocumentId]);

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const filteredDocuments = documents.filter((document) =>
    document.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const previewConfig = selectedDocument ? getPreviewConfig(selectedDocument.url) : null;
  const currentVersionHistory = selectedDocument
    ? [
        {
          id: `${selectedDocument.id}-current`,
          createdAt: selectedDocument.updatedAt,
          updatedAt: selectedDocument.updatedAt,
          documentId: selectedDocument.id,
          projectId: selectedDocument.projectId,
          name: selectedDocument.name,
          type: selectedDocument.type,
          url: selectedDocument.url,
          uploadedBy: selectedDocument.uploadedBy,
          version: selectedDocument.version,
        },
        ...versions,
      ]
    : [];

  const loadVersions = async (document: ProjectDocument) => {
    try {
      setSelectedDocumentId(document.id);
      setLoadingVersions(true);
      setError(null);

      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/versions`);
      const data = await parseApiResponse<{ versions: DocumentVersion[] }>(response);
      setVersions(sortByNewest(data.versions));

      if (!getPreviewConfig(document.url)) {
        window.open(document.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "バージョン履歴の読み込みに失敗しました。");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          url: url.trim(),
          uploadedBy: user?.email ?? "Compass Web",
          version: "v1.0",
        }),
      });
      const data = await parseApiResponse<{ document: ProjectDocument }>(response);

      setDocuments((current) => sortByNewest([data.document, ...current]));
      setName("");
      setType("drawing");
      setUrl("");
      await loadVersions(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ドキュメントの登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">ドキュメントを読み込み中...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-slate-500">プロジェクトが見つかりません</p>
        <button
          onClick={() => navigate("/app")}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pb-24">
      <button
        type="button"
        onClick={() => navigate("/app")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <span aria-hidden="true">&larr;</span>
        プロジェクト一覧
      </button>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5 shrink-0">!</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">
            &times;
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Project Documents</p>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="mt-1 text-sm text-brand-200">図面、契約、写真、請求書を案件単位で整理します。</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs text-brand-200">登録済みドキュメント</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{documents.length}</p>
          </div>
        </div>
      </section>

      <ProjectDetailTabs projectId={projectId} activeTab="documents" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">ドキュメント検索</h2>
                <p className="text-sm text-slate-500">名前で横断検索し、種別ごとに確認できます。</p>
              </div>
              <label className="w-full sm:max-w-xs">
                <span className="sr-only">ドキュメント検索</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ドキュメント名で検索"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">アップロード登録</h2>
                <p className="text-sm text-slate-500">ファイル本体は Drive 等に置き、ここでは参照 URL を管理します。</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">初回版は v1.0</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">ファイル名</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例: 意匠図_A-101"
                  maxLength={200}
                  required
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">種別</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as DocumentType)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-medium text-slate-500">ファイル URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  required
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "登録中..." : "ドキュメントを追加"}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            {DOCUMENT_TYPE_OPTIONS.map((option) => {
              const groupedDocuments = filteredDocuments.filter((document) => document.type === option.value);
              return (
                <div key={option.value} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">{option.label}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {groupedDocuments.length}件
                    </span>
                  </div>

                  {groupedDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">
                      {searchQuery.trim() ? "検索条件に一致するドキュメントはありません。" : `${option.label}のドキュメントは未登録です。`}
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {sortByNewest(groupedDocuments).map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => void loadVersions(document)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left ${
                            selectedDocumentId === document.id
                              ? "border-brand-300 bg-brand-50"
                              : "border-slate-200 hover:border-brand-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{document.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{documentTypeLabels[document.type]} / {document.uploadedBy}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2 text-xs text-slate-500">
                              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">アップロード {formatDocumentDate(document.createdAt)}</span>
                              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">版 {document.version}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">プレビュー</h2>
                <p className="text-sm text-slate-500">ドキュメントを選択すると内容と履歴を確認できます。</p>
              </div>
              {selectedDocument ? (
                <a
                  href={selectedDocument.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700"
                >
                  元ファイルを開く
                </a>
              ) : null}
            </div>

            {selectedDocument ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{selectedDocument.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {documentTypeLabels[selectedDocument.type]} / 現在版 {selectedDocument.version}
                  </p>
                </div>

                {previewConfig?.mode === "image" ? (
                  <img
                    src={previewConfig.src}
                    alt={selectedDocument.name}
                    className="max-h-[420px] w-full rounded-2xl border border-slate-200 object-contain"
                  />
                ) : null}

                {previewConfig?.mode === "iframe" ? (
                  <iframe
                    title={`${selectedDocument.name} プレビュー`}
                    src={previewConfig.src}
                    className="h-[420px] w-full rounded-2xl border border-slate-200 bg-slate-50"
                  />
                ) : null}

                {!previewConfig ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    このファイル形式はインライン表示に対応していません。上のボタンから元ファイルを開いてください。
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                左側の一覧からドキュメントを選択してください。
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">バージョン履歴</h2>
                <p className="text-sm text-slate-500">選択中ドキュメントの版管理を確認します。</p>
              </div>
              {loadingVersions ? <span className="text-xs font-semibold text-brand-600">読み込み中...</span> : null}
            </div>

            {selectedDocument ? (
              currentVersionHistory.length > 0 ? (
                <ol className="mt-4 space-y-2">
                  {currentVersionHistory.map((version, index) => (
                    <li key={version.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {version.version}
                            {index === 0 ? (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                現在版
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{formatDocumentDate(version.createdAt)} / {version.uploadedBy}</p>
                        </div>
                        <a
                          href={version.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                        >
                          開く
                        </a>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-slate-500">このドキュメントはまだ履歴がありません。</p>
              )
            ) : (
              <p className="mt-4 text-sm text-slate-500">履歴を表示するドキュメントを選択してください。</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
