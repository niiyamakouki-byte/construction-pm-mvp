import { useCallback, useEffect, useState } from "react";
import type { Project, ProjectStatus } from "../domain/types.js";
import { projectRepository } from "../stores/project-store.js";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
    <section>
      <h2>プロジェクト一覧</h2>

      {projects.length === 0 ? (
        <p>プロジェクトがありません</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>ステータス</th>
              <th>開始日</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>{p.startDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>新規プロジェクト</h3>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            名前
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            説明
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            ステータス
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              <option value="planning">planning</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="on_hold">on_hold</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            開始日
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
        </div>
        <button type="submit">作成</button>
      </form>
    </section>
  );
}
