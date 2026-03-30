import { useCallback, useEffect, useState } from "react";
import type { Project, ProjectStatus } from "../domain/types.js";
import { projectRepository } from "../stores/project-store.js";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const statusLabel: Record<ProjectStatus, string> = {
  planning: "計画中",
  active: "進行中",
  completed: "完了",
  on_hold: "保留",
};

const statusColor: Record<ProjectStatus, string> = {
  planning: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-slate-100 text-slate-800",
  on_hold: "bg-amber-100 text-amber-800",
};

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setProjects(await projectRepository.findAll());
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    try {
      const now = new Date();
      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        status,
        startDate: startDate || toLocalDateString(now),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await projectRepository.create(project);
      setName("");
      setDescription("");
      setStatus("planning");
      setStartDate("");
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  };

  return (
    <div className="space-y-8">
      {/* Project List */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          プロジェクト一覧
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            <p>プロジェクトがありません</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">名前</th>
                  <th className="px-4 py-3 font-medium text-slate-600">ステータス</th>
                  <th className="px-4 py-3 font-medium text-slate-600">開始日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.startDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* New Project Form */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          新規プロジェクト
        </h3>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              名前
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
                placeholder="プロジェクト名を入力"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              説明
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
                placeholder="説明を入力（任意）"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-slate-700">
              ステータス
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
              >
                <option value="planning">計画中</option>
                <option value="active">進行中</option>
                <option value="completed">完了</option>
                <option value="on_hold">保留</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              開始日
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:outline-none"
          >
            作成
          </button>
        </form>
      </section>
    </div>
  );
}
