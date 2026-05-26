/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { ApiError } from "./types.js";
import { parseMemoProjectText } from "./memo-project-parser.js";

describe("parseMemoProjectText", () => {
  const cases = [
    ["白金台 中川邸 完工", "中川邸", "白金台", "completed", "completed", "完工"],
    ["渋谷バー 着工", "渋谷バー", undefined, "in_progress", "active", "着工"],
    ["世田谷 山田様邸 進行中", "山田様邸", "世田谷", "in_progress", "active", "進行中"],
    ["銀座 店舗工事 終わった", "店舗工事", "銀座", "completed", "completed", "終わった"],
    ["六本木 改修 済み", "改修", "六本木", "completed", "completed", "済み"],
    ["青山 ショールーム 見積中", "ショールーム", "青山", "planning", "planning", "見積中"],
    ["赤坂 オフィス 計画中", "オフィス", "赤坂", "planning", "planning", "計画中"],
    ["新宿 テナント 施工中", "テナント", "新宿", "in_progress", "active", "施工中"],
    ["恵比寿 レストラン 工事中", "レストラン", "恵比寿", "in_progress", "active", "工事中"],
    ["中目黒 カフェ 予定", "カフェ", "中目黒", "planning", "planning", "予定"],
    ["案件名だけ", "案件名だけ", undefined, "planning", "planning", undefined],
  ] as const;

  it.each(cases)(
    "自然文から案件名・住所候補・ステータスを抽出する: %s",
    (naturalText, name, addressCandidate, naturalStatus, projectStatus, keyword) => {
      const result = parseMemoProjectText({ naturalText, source: "discord" });

      expect(result).toMatchObject({
        naturalText,
        source: "discord",
        name,
        addressCandidate,
        naturalStatus,
        projectStatus,
        matchedStatusKeyword: keyword,
      });
    },
  );

  it("全角スペースと句読点を正規化する", () => {
    const result = parseMemoProjectText({
      naturalText: "白金台　中川邸、完工",
      source: "line",
    });

    expect(result).toMatchObject({
      naturalText: "白金台 中川邸 完工",
      source: "line",
      name: "中川邸",
      addressCandidate: "白金台",
      naturalStatus: "completed",
      projectStatus: "completed",
    });
  });

  it("source が不正なら400を投げる", () => {
    expect(() => parseMemoProjectText({ naturalText: "白金台 中川邸", source: "email" }))
      .toThrow(ApiError);
  });

  it("案件名がない自然文は400を投げる", () => {
    expect(() => parseMemoProjectText({ naturalText: "完工", source: "manual" })).toThrow(
      ApiError,
    );
  });
});
