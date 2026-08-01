import { describe, expect, it } from "vitest";
import { toFriendlyErrorMessage } from "./friendly-error.js";

describe("toFriendlyErrorMessage", () => {
  it("生のPostgresトリガー例外文言はフォールバックに置き換える(bead f1xi2)", () => {
    const err = new Error("exactly one organization membership is required when organization_id is omitted");
    expect(toFriendlyErrorMessage(err, "作成に失敗しました")).toBe("作成に失敗しました");
  });

  it("duplicate key違反もフォールバックに置き換える", () => {
    const err = new Error('duplicate key value violates unique constraint "projects_pkey"');
    expect(toFriendlyErrorMessage(err, "作成に失敗しました")).toBe("作成に失敗しました");
  });

  it("既知パターンに該当しないErrorはそのままのメッセージを返す(既存挙動を維持)", () => {
    const err = new Error("テストエラー");
    expect(toFriendlyErrorMessage(err, "作成に失敗しました")).toBe("テストエラー");
  });

  it("Errorでない値はフォールバックを返す", () => {
    expect(toFriendlyErrorMessage("string throw", "作成に失敗しました")).toBe("作成に失敗しました");
    expect(toFriendlyErrorMessage(null, "作成に失敗しました")).toBe("作成に失敗しました");
  });
});
