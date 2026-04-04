/**
 * E2E: CSVインポート→タスク生成フロー
 * GanttPageで使われているCSVパーサーロジックを再現してテスト
 */
import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "../../infra/in-memory-repository.js";
import type { Task } from "../../domain/types.js";

// ── CSVパーサー（GanttPage.tsxと同一ロジックを抽出） ─────────────

type CsvRow = {
  name: string;
  startDate: string;
  dueDate: string;
  contractorId?: string;
  materials?: string[];
  leadTimeDays?: number;
};

function parseCsvToTaskRows(csvText: string): CsvRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const get = (key: string) => vals[headers.indexOf(key)] ?? "";

    const name = get("タスク名");
    const startDate = get("開始日") || "2025-06-01";
    const dueDate = get("終了日") || startDate;
    const contractorName = get("担当業者");
    const materialStr = get("材料");
    const leadTimeStr = get("リードタイム日数");

    return {
      name,
      startDate,
      dueDate,
      contractorId: contractorName || undefined,
      materials: materialStr ? [materialStr] : [],
      leadTimeDays: leadTimeStr ? Number(leadTimeStr) : 0,
    };
  });
}

async function importCsvToRepo(
  csvText: string,
  projectId: string,
  repo: InMemoryRepository<Task>,
): Promise<{ success: number; error: number }> {
  const rows = parseCsvToTaskRows(csvText);
  let success = 0;
  let error = 0;

  for (const row of rows) {
    if (!row.name) {
      error++;
      continue;
    }
    try {
      const now = new Date().toISOString();
      await repo.create({
        id: crypto.randomUUID(),
        projectId,
        name: row.name,
        description: "",
        status: "todo",
        progress: 0,
        dependencies: [],
        startDate: row.startDate,
        dueDate: row.dueDate,
        contractorId: row.contractorId,
        materials: row.materials,
        leadTimeDays: row.leadTimeDays,
        createdAt: now,
        updatedAt: now,
      });
      success++;
    } catch {
      error++;
    }
  }

  return { success, error };
}

// ── テストデータ ────────────────────────────────────────────────

const SAMPLE_CSV = `タスク名,開始日,終了日,担当業者,材料,リードタイム日数
墨出し・下地確認,2025-06-01,2025-06-02,田中工務店,,0
解体・撤去,2025-06-03,2025-06-05,田中工務店,,1
下地工事,2025-06-06,2025-06-10,山田建設,石膏ボード,2
塗装工事,2025-06-11,2025-06-15,佐藤塗装,ペンキ,3
仕上げ,2025-06-16,2025-06-20,東京内装,,0
`;

// ── テスト ──────────────────────────────────────────────────

describe("E2E: CSVインポート→タスク生成", () => {
  it("CSVから5件のタスクが生成される", async () => {
    const repo = new InMemoryRepository<Task>();
    const result = await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    expect(result.success).toBe(5);
    expect(result.error).toBe(0);

    const tasks = await repo.findAll();
    expect(tasks).toHaveLength(5);
  });

  it("タスク名が正しくインポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    const names = tasks.map((t) => t.name).sort();
    expect(names).toContain("墨出し・下地確認");
    expect(names).toContain("塗装工事");
    expect(names).toContain("仕上げ");
  });

  it("日付がインポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    const first = tasks.find((t) => t.name === "墨出し・下地確認");
    expect(first!.startDate).toBe("2025-06-01");
    expect(first!.dueDate).toBe("2025-06-02");
  });

  it("担当業者は contractorId に保存される", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    const first = tasks.find((t) => t.name === "墨出し・下地確認");
    expect(first!.contractorId).toBe("田中工務店");
    expect(first!.assigneeId).toBeUndefined();
  });

  it("材料フィールドがインポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    const kaji = tasks.find((t) => t.name === "下地工事");
    expect(kaji!.materials).toContain("石膏ボード");
  });

  it("リードタイムがインポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    const paint = tasks.find((t) => t.name === "塗装工事");
    expect(paint!.leadTimeDays).toBe(3);
  });

  it("空のCSVは0件インポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    const result = await importCsvToRepo("", "proj-1", repo);

    expect(result.success).toBe(0);
    expect(await repo.findAll()).toHaveLength(0);
  });

  it("ヘッダーのみのCSVは0件インポートされる", async () => {
    const repo = new InMemoryRepository<Task>();
    const result = await importCsvToRepo(
      "タスク名,開始日,終了日",
      "proj-1",
      repo,
    );
    expect(result.success).toBe(0);
  });

  it("全タスクに同じprojectIdが設定される", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-abc", repo);

    const tasks = await repo.findAll();
    expect(tasks.every((t) => t.projectId === "proj-abc")).toBe(true);
  });

  it("インポートされたタスクのstatus初期値はtodo", async () => {
    const repo = new InMemoryRepository<Task>();
    await importCsvToRepo(SAMPLE_CSV, "proj-1", repo);

    const tasks = await repo.findAll();
    expect(tasks.every((t) => t.status === "todo")).toBe(true);
  });
});
