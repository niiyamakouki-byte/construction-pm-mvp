import { describe, expect, it, beforeEach } from "vitest";
import {
  addMoodBoardItem,
  calcTotalPrice,
  clearMoodBoards,
  createMoodBoard,
  deleteMoodBoard,
  getMoodBoard,
  getMoodBoardsByProject,
  moveItem,
  removeMoodBoardItem,
  resizeItem,
  updateMoodBoard,
  updateMoodBoardItem,
  type MoodBoard,
  type MoodBoardItem,
} from "./mood-board.js";

function makeBoard(overrides: Partial<Omit<MoodBoard, "id" | "items" | "createdAt">> = {}): MoodBoard {
  return createMoodBoard({
    projectId: "proj-1",
    title: "リビング提案",
    ...overrides,
  });
}

function makeItemParams(overrides: Partial<Omit<MoodBoardItem, "id">> = {}): Omit<MoodBoardItem, "id"> {
  return {
    imageUrl: "https://example.com/floor.jpg",
    title: "オーク床材",
    description: "天然木突板",
    category: "床",
    supplier: "メーカーA",
    price: 120000,
    position: { x: 10, y: 20 },
    size: { w: 200, h: 150 },
    ...overrides,
  };
}

describe("mood-board", () => {
  beforeEach(() => {
    clearMoodBoards();
  });

  describe("createMoodBoard", () => {
    it("creates board with empty items and timestamp", () => {
      const board = makeBoard();
      expect(board.id).toMatch(/^mb-/);
      expect(board.items).toHaveLength(0);
      expect(board.createdAt).toBeTruthy();
    });

    it("stores board retrievable by id", () => {
      const board = makeBoard();
      expect(getMoodBoard(board.id)).toEqual(board);
    });
  });

  describe("getMoodBoardsByProject", () => {
    it("filters by projectId", () => {
      makeBoard({ projectId: "proj-1" });
      makeBoard({ projectId: "proj-2" });
      makeBoard({ projectId: "proj-1" });
      expect(getMoodBoardsByProject("proj-1")).toHaveLength(2);
      expect(getMoodBoardsByProject("proj-2")).toHaveLength(1);
    });
  });

  describe("updateMoodBoard", () => {
    it("updates title", () => {
      const board = makeBoard();
      const updated = updateMoodBoard(board.id, { title: "新タイトル" });
      expect(updated?.title).toBe("新タイトル");
    });

    it("returns undefined for unknown id", () => {
      expect(updateMoodBoard("nonexistent", { title: "x" })).toBeUndefined();
    });
  });

  describe("deleteMoodBoard", () => {
    it("deletes existing board", () => {
      const board = makeBoard();
      expect(deleteMoodBoard(board.id)).toBe(true);
      expect(getMoodBoard(board.id)).toBeUndefined();
    });

    it("returns false for nonexistent id", () => {
      expect(deleteMoodBoard("nope")).toBe(false);
    });
  });

  describe("addMoodBoardItem", () => {
    it("adds item to board", () => {
      const board = makeBoard();
      const item = addMoodBoardItem(board.id, makeItemParams());
      expect(item?.id).toMatch(/^mbi-/);
      expect(getMoodBoard(board.id)?.items).toHaveLength(1);
    });

    it("returns undefined for unknown board", () => {
      expect(addMoodBoardItem("nope", makeItemParams())).toBeUndefined();
    });

    it("preserves all fields", () => {
      const board = makeBoard();
      const params = makeItemParams({ category: "照明", price: 50000 });
      const item = addMoodBoardItem(board.id, params);
      expect(item?.category).toBe("照明");
      expect(item?.price).toBe(50000);
    });
  });

  describe("updateMoodBoardItem", () => {
    it("updates item fields", () => {
      const board = makeBoard();
      const item = addMoodBoardItem(board.id, makeItemParams())!;
      const updated = updateMoodBoardItem(board.id, item.id, { title: "変更後" });
      expect(updated?.title).toBe("変更後");
    });

    it("returns undefined for unknown item", () => {
      const board = makeBoard();
      expect(updateMoodBoardItem(board.id, "nope", { title: "x" })).toBeUndefined();
    });
  });

  describe("removeMoodBoardItem", () => {
    it("removes item from board", () => {
      const board = makeBoard();
      const item = addMoodBoardItem(board.id, makeItemParams())!;
      expect(removeMoodBoardItem(board.id, item.id)).toBe(true);
      expect(getMoodBoard(board.id)?.items).toHaveLength(0);
    });

    it("returns false for nonexistent item", () => {
      const board = makeBoard();
      expect(removeMoodBoardItem(board.id, "nope")).toBe(false);
    });
  });

  describe("moveItem", () => {
    it("updates position", () => {
      const board = makeBoard();
      const item = addMoodBoardItem(board.id, makeItemParams())!;
      const moved = moveItem(board.id, item.id, { x: 100, y: 200 });
      expect(moved?.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe("resizeItem", () => {
    it("updates size", () => {
      const board = makeBoard();
      const item = addMoodBoardItem(board.id, makeItemParams())!;
      const resized = resizeItem(board.id, item.id, { w: 300, h: 250 });
      expect(resized?.size).toEqual({ w: 300, h: 250 });
    });
  });

  describe("calcTotalPrice", () => {
    it("sums item prices", () => {
      const board = makeBoard();
      addMoodBoardItem(board.id, makeItemParams({ price: 100000 }));
      addMoodBoardItem(board.id, makeItemParams({ price: 50000 }));
      addMoodBoardItem(board.id, makeItemParams({ price: undefined }));
      const updated = getMoodBoard(board.id)!;
      expect(calcTotalPrice(updated)).toBe(150000);
    });

    it("returns 0 for empty board", () => {
      const board = getMoodBoard(makeBoard().id)!;
      expect(calcTotalPrice(board)).toBe(0);
    });
  });
});
