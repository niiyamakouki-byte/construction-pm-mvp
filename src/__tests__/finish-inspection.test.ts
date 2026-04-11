/**
 * 仕上検査モジュール テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearInspections,
  createRoomInspection,
  addInspectionItem,
  updateItemStatus,
  completeInspection,
  approveInspection,
  getInspectionsByProject,
  getInspectionProgress,
  getProjectInspectionSummary,
  buildFinishInspectionHtml,
  type RoomInspection,
  type FinishInspectionItem,
} from "../lib/finish-inspection.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<Omit<RoomInspection, "id" | "status" | "items" | "createdAt" | "updatedAt">> = {}): RoomInspection {
  return createRoomInspection({
    projectId: overrides.projectId ?? "proj-1",
    roomName: overrides.roomName ?? "応接室",
    floor: overrides.floor ?? "3F",
    inspectionDate: overrides.inspectionDate ?? "2026-04-11",
    inspector: overrides.inspector ?? "我妻",
  });
}

function makeItem(overrides: Partial<Omit<FinishInspectionItem, "id">> = {}): Omit<FinishInspectionItem, "id"> {
  return {
    category: overrides.category ?? "壁仕上",
    description: overrides.description ?? "クロス張り仕上げ確認",
    status: overrides.status ?? "ok",
    photos: overrides.photos ?? [],
    comment: overrides.comment ?? "",
    ...(overrides.pinId !== undefined ? { pinId: overrides.pinId } : {}),
    ...(overrides.correctionId !== undefined ? { correctionId: overrides.correctionId } : {}),
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("仕上検査モジュール", () => {
  beforeEach(() => {
    clearInspections();
  });

  // ── 作成 ────────────────────────────────────────────────────────────────────

  it("createRoomInspection: 初期ステータスは not_started", () => {
    const room = makeRoom();
    expect(room.status).toBe("not_started");
    expect(room.id).toBeTruthy();
    expect(room.items).toEqual([]);
  });

  it("createRoomInspection: 部屋情報が正しく設定される", () => {
    const room = makeRoom({ roomName: "会議室A", floor: "2F", inspector: "鈴木" });
    expect(room.roomName).toBe("会議室A");
    expect(room.floor).toBe("2F");
    expect(room.inspector).toBe("鈴木");
  });

  // ── 検査項目追加 ──────────────────────────────────────────────────────────────

  it("addInspectionItem: 項目が追加されステータスが in_progress に変わる", () => {
    const room = makeRoom();
    expect(room.status).toBe("not_started");
    const updated = addInspectionItem(room.id, makeItem());
    expect(updated.items).toHaveLength(1);
    expect(updated.status).toBe("in_progress");
  });

  it("addInspectionItem: pinId・correctionId で連携できる", () => {
    const room = makeRoom();
    const updated = addInspectionItem(room.id, makeItem({ pinId: "pin-001", correctionId: "cor-001" }));
    expect(updated.items[0]!.pinId).toBe("pin-001");
    expect(updated.items[0]!.correctionId).toBe("cor-001");
  });

  it("addInspectionItem: カテゴリが内装特化カテゴリを受け付ける", () => {
    const room = makeRoom();
    const updated = addInspectionItem(room.id, makeItem({ category: "クロス", description: "クロス継ぎ目確認" }));
    expect(updated.items[0]!.category).toBe("クロス");
  });

  it("addInspectionItem: 複数項目を追加できる", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem({ category: "天井仕上" }));
    addInspectionItem(room.id, makeItem({ category: "床仕上" }));
    const updated = addInspectionItem(room.id, makeItem({ category: "建具" }));
    expect(updated.items).toHaveLength(3);
  });

  // ── 項目ステータス更新 ─────────────────────────────────────────────────────────

  it("updateItemStatus: NG に更新できる", () => {
    const room = makeRoom();
    const withItem = addInspectionItem(room.id, makeItem({ status: "ok" }));
    const itemId = withItem.items[0]!.id;
    const updated = updateItemStatus(room.id, itemId, "ng", "クロス浮き確認");
    expect(updated.items[0]!.status).toBe("ng");
    expect(updated.items[0]!.comment).toBe("クロス浮き確認");
  });

  it("updateItemStatus: NA に更新できる", () => {
    const room = makeRoom();
    const withItem = addInspectionItem(room.id, makeItem({ status: "ok" }));
    const itemId = withItem.items[0]!.id;
    const updated = updateItemStatus(room.id, itemId, "na");
    expect(updated.items[0]!.status).toBe("na");
  });

  it("updateItemStatus: 存在しない項目IDは例外を投げる", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem());
    expect(() => updateItemStatus(room.id, "nonexistent-item-id", "ng")).toThrow("not found");
  });

  // ── 状態遷移 ──────────────────────────────────────────────────────────────────

  it("completeInspection: in_progress → completed", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem()); // triggers in_progress
    const completed = completeInspection(room.id);
    expect(completed.status).toBe("completed");
  });

  it("approveInspection: completed → approved", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem());
    completeInspection(room.id);
    const approved = approveInspection(room.id);
    expect(approved.status).toBe("approved");
  });

  it("全工程 happy path: not_started→in_progress→completed→approved", () => {
    const room = makeRoom();
    expect(room.status).toBe("not_started");
    const withItem = addInspectionItem(room.id, makeItem());
    expect(withItem.status).toBe("in_progress");
    expect(completeInspection(room.id).status).toBe("completed");
    expect(approveInspection(room.id).status).toBe("approved");
  });

  it("不正遷移: not_started → completed は例外を投げる", () => {
    const room = makeRoom();
    expect(() => completeInspection(room.id)).toThrow("ステータス遷移不可");
  });

  it("不正遷移: approved → completed は例外を投げる", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem());
    completeInspection(room.id);
    approveInspection(room.id);
    expect(() => completeInspection(room.id)).toThrow("ステータス遷移不可");
  });

  it("存在しないIDは例外を投げる", () => {
    expect(() => completeInspection("nonexistent-id")).toThrow("not found");
  });

  // ── 一覧取得 ──────────────────────────────────────────────────────────────────

  it("getInspectionsByProject: プロジェクトIDでフィルタリング", () => {
    makeRoom({ projectId: "proj-1" });
    makeRoom({ projectId: "proj-1" });
    makeRoom({ projectId: "proj-2" });
    expect(getInspectionsByProject("proj-1")).toHaveLength(2);
    expect(getInspectionsByProject("proj-2")).toHaveLength(1);
    expect(getInspectionsByProject("proj-99")).toHaveLength(0);
  });

  // ── 進捗集計 ──────────────────────────────────────────────────────────────────

  it("getInspectionProgress: OK/NG/NA件数を正しく集計する", () => {
    const room = makeRoom();
    addInspectionItem(room.id, makeItem({ status: "ok" }));
    addInspectionItem(room.id, makeItem({ status: "ok" }));
    addInspectionItem(room.id, makeItem({ status: "ng" }));
    addInspectionItem(room.id, makeItem({ status: "na" }));
    const rooms = getInspectionsByProject("proj-1");
    const progress = getInspectionProgress(rooms[0]!);
    expect(progress.ok).toBe(2);
    expect(progress.ng).toBe(1);
    expect(progress.na).toBe(1);
    expect(progress.total).toBe(4);
    expect(progress.ngRate).toBeCloseTo(1 / 3);
  });

  it("getInspectionProgress: 項目なしは ngRate = 0", () => {
    const room = makeRoom();
    const progress = getInspectionProgress(room);
    expect(progress.ok).toBe(0);
    expect(progress.ng).toBe(0);
    expect(progress.ngRate).toBe(0);
  });

  it("getProjectInspectionSummary: 全部屋の進捗を集計する", () => {
    const r1 = makeRoom({ projectId: "proj-s" });
    addInspectionItem(r1.id, makeItem({ status: "ok" }));
    addInspectionItem(r1.id, makeItem({ status: "ng" }));
    completeInspection(r1.id);
    approveInspection(r1.id);

    const r2 = makeRoom({ projectId: "proj-s" });
    addInspectionItem(r2.id, makeItem({ status: "ok" }));
    completeInspection(r2.id);

    makeRoom({ projectId: "proj-s" }); // not_started

    const summary = getProjectInspectionSummary("proj-s");
    expect(summary.totalRooms).toBe(3);
    expect(summary.completedRooms).toBe(2); // completed + approved
    expect(summary.approvedRooms).toBe(1);
    expect(summary.totalOk).toBe(2);
    expect(summary.totalNg).toBe(1);
  });

  it("getProjectInspectionSummary: データなしは全0", () => {
    const summary = getProjectInspectionSummary("empty-project");
    expect(summary.totalRooms).toBe(0);
    expect(summary.totalOk).toBe(0);
    expect(summary.totalNg).toBe(0);
  });

  // ── 帳票HTML ─────────────────────────────────────────────────────────────────

  it("buildFinishInspectionHtml: HTMLを生成する", () => {
    const room = makeRoom({ projectId: "proj-r", roomName: "応接室", floor: "3F" });
    addInspectionItem(room.id, makeItem({ category: "クロス", description: "クロス浮き確認", status: "ng" }));
    addInspectionItem(room.id, makeItem({ category: "床仕上", description: "フローリング傷確認", status: "ok" }));
    const html = buildFinishInspectionHtml("proj-r", "KDX南青山ビル");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("KDX南青山ビル");
    expect(html).toContain("1室");
    expect(html).toContain("応接室");
    expect(html).toContain("3F");
    expect(html).toContain("クロス浮き確認");
    expect(html).toContain("フローリング傷確認");
  });

  it("buildFinishInspectionHtml: データなしは「検査データなし」を表示", () => {
    const html = buildFinishInspectionHtml("empty-proj", "テスト現場");
    expect(html).toContain("検査データなし");
    expect(html).toContain("0室");
  });

  it("buildFinishInspectionHtml: HTMLエスケープが適用される", () => {
    const room = makeRoom({ projectId: "proj-xss", roomName: "<script>xss</script>" });
    addInspectionItem(room.id, makeItem({ description: "<b>test</b>" }));
    const html = buildFinishInspectionHtml("proj-xss", "<Test>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Test&gt;");
    expect(html).toContain("&lt;b&gt;");
  });

  it("buildFinishInspectionHtml: NG件数サマリーが含まれる", () => {
    const room = makeRoom({ projectId: "proj-ng" });
    addInspectionItem(room.id, makeItem({ status: "ng" }));
    addInspectionItem(room.id, makeItem({ status: "ng" }));
    const html = buildFinishInspectionHtml("proj-ng", "NG現場");
    expect(html).toContain("NG: </span><span");
    expect(html).toContain("2件");
  });
});
