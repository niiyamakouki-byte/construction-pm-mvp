import { describe, it, expect, beforeEach } from "vitest";
import { MoodBoardRepository, type MoodBoardRecord } from "./MoodBoardRepository.js";

function makeBoard(overrides: Partial<MoodBoardRecord> = {}): MoodBoardRecord {
  const now = new Date().toISOString();
  return {
    id: "mb-1",
    projectId: "proj-1",
    title: "リビング提案",
    items: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("MoodBoardRepository (InMemory mode)", () => {
  let repo: MoodBoardRepository;

  beforeEach(() => {
    repo = new MoodBoardRepository(false);
  });

  it("getAsync returns null for unknown id", async () => {
    expect(await repo.getAsync("missing")).toBeNull();
  });

  it("saveAsync persists board, getAsync retrieves it", async () => {
    const b = makeBoard();
    await repo.saveAsync(b);
    const result = await repo.getAsync("mb-1");
    expect(result?.title).toBe("リビング提案");
  });

  it("listByProjectAsync filters by projectId", async () => {
    await repo.saveAsync(makeBoard({ id: "mb-a", projectId: "p-1" }));
    await repo.saveAsync(makeBoard({ id: "mb-b", projectId: "p-2" }));
    await repo.saveAsync(makeBoard({ id: "mb-c", projectId: "p-1" }));

    const boards = await repo.listByProjectAsync("p-1");
    expect(boards).toHaveLength(2);
    expect(boards.map((b) => b.id).sort()).toEqual(["mb-a", "mb-c"]);
  });

  it("saveAsync updates existing record", async () => {
    await repo.saveAsync(makeBoard());
    await repo.saveAsync(makeBoard({ title: "変更後" }));
    const result = await repo.getAsync("mb-1");
    expect(result?.title).toBe("変更後");
  });

  it("saveAsync preserves items", async () => {
    await repo.saveAsync(
      makeBoard({
        items: [
          {
            id: "i-1",
            imageUrl: "https://example.com/a.jpg",
            title: "オーク",
            description: "desc",
            category: "床",
            position: { x: 0, y: 0 },
            size: { w: 100, h: 100 },
          },
        ],
      }),
    );
    const result = await repo.getAsync("mb-1");
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].title).toBe("オーク");
  });

  it("deleteAsync returns true on existing id, false on missing", async () => {
    await repo.saveAsync(makeBoard());
    expect(await repo.deleteAsync("mb-1")).toBe(true);
    expect(await repo.deleteAsync("mb-1")).toBe(false);
    expect(await repo.getAsync("mb-1")).toBeNull();
  });

  it("_reset clears state", async () => {
    await repo.saveAsync(makeBoard());
    repo._reset();
    expect(await repo.getAsync("mb-1")).toBeNull();
  });

  it("saveAsync copies items array (push to caller's array does not leak)", async () => {
    const board = makeBoard({
      items: [
        {
          id: "i-1",
          imageUrl: "https://example.com/a.jpg",
          title: "orig",
          description: "",
          category: "床",
          position: { x: 0, y: 0 },
          size: { w: 100, h: 100 },
        },
      ],
    });
    await repo.saveAsync(board);
    board.items.push({
      id: "i-2",
      imageUrl: "https://example.com/b.jpg",
      title: "leaked",
      description: "",
      category: "壁",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 100 },
    });
    const persisted = await repo.getAsync("mb-1");
    expect(persisted?.items).toHaveLength(1);
  });

  it("listByProjectAsync returns empty array when no matches", async () => {
    await repo.saveAsync(makeBoard({ projectId: "other" }));
    expect(await repo.listByProjectAsync("nonexistent")).toEqual([]);
  });
});
