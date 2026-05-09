/**
 * Tests for requirement-extractor.
 */

import { describe, expect, it } from "vitest";
import { extractRequirements } from "../requirement-extractor.js";

// 基準日 = 2026-05-09 (月) として固定
const BASE_DATE = new Date("2026-05-09T09:00:00+09:00");

describe("requirement-extractor — workCategory", () => {
  it("「キッチン」 → kitchen", () => {
    const r = extractRequirements("キッチンをリフォームしたい", BASE_DATE);
    expect(r.workCategory).toBe("kitchen");
  });

  it("「台所」 → kitchen", () => {
    const r = extractRequirements("台所を全部新しくしたい", BASE_DATE);
    expect(r.workCategory).toBe("kitchen");
  });

  it("「システムキッチン」 → kitchen", () => {
    const r = extractRequirements("システムキッチンの交換をお願いしたい", BASE_DATE);
    expect(r.workCategory).toBe("kitchen");
  });

  it("「お風呂」 → bath", () => {
    const r = extractRequirements("お風呂を新しくしたいです", BASE_DATE);
    expect(r.workCategory).toBe("bath");
  });

  it("「浴室」 → bath", () => {
    const r = extractRequirements("浴室リフォームをお願いします", BASE_DATE);
    expect(r.workCategory).toBe("bath");
  });

  it("「ユニットバス」 → bath", () => {
    const r = extractRequirements("ユニットバスの交換工事", BASE_DATE);
    expect(r.workCategory).toBe("bath");
  });

  it("「店舗」 → store_fit", () => {
    const r = extractRequirements("店舗の内装工事をお願いしたい", BASE_DATE);
    expect(r.workCategory).toBe("store_fit");
  });

  it("「飲食店」 → store_fit", () => {
    const r = extractRequirements("飲食店を新規オープンするので内装工事を", BASE_DATE);
    expect(r.workCategory).toBe("store_fit");
  });

  it("「カフェ」 → store_fit", () => {
    const r = extractRequirements("カフェの内装改装工事について", BASE_DATE);
    expect(r.workCategory).toBe("store_fit");
  });

  it("「ネイルサロン」 → store_fit", () => {
    const r = extractRequirements("ネイルサロンの新規内装工事", BASE_DATE);
    expect(r.workCategory).toBe("store_fit");
  });

  it("「事務所」 → office_fit", () => {
    const r = extractRequirements("事務所のリフォームをお願いしたい", BASE_DATE);
    expect(r.workCategory).toBe("office_fit");
  });

  it("「オフィス」 → office_fit", () => {
    const r = extractRequirements("オフィスの内装工事を検討しています", BASE_DATE);
    expect(r.workCategory).toBe("office_fit");
  });

  it("「コワーキング」 → office_fit", () => {
    const r = extractRequirements("コワーキングスペースの内装工事", BASE_DATE);
    expect(r.workCategory).toBe("office_fit");
  });

  it("「外壁」 → exterior", () => {
    const r = extractRequirements("外壁の塗装をお願いしたい", BASE_DATE);
    expect(r.workCategory).toBe("exterior");
  });

  it("「屋根」 → exterior", () => {
    const r = extractRequirements("屋根の修繕工事", BASE_DATE);
    expect(r.workCategory).toBe("exterior");
  });

  it("「補修」 → repair", () => {
    const r = extractRequirements("クロスの補修と床の補修をお願いしたい", BASE_DATE);
    expect(r.workCategory).toBe("repair");
  });

  it("「クロス」 → repair", () => {
    const r = extractRequirements("クロスの貼り替えをお願いしたいです", BASE_DATE);
    expect(r.workCategory).toBe("repair");
  });

  it("「全面リノベ」 → full_renovation (優先)", () => {
    const r = extractRequirements("キッチンも含めて全面リノベーションをしたいです", BASE_DATE);
    expect(r.workCategory).toBe("full_renovation");
  });

  it("「フルリノベ」 → full_renovation", () => {
    const r = extractRequirements("自宅をフルリノベしたい", BASE_DATE);
    expect(r.workCategory).toBe("full_renovation");
  });

  it("「リビング」 → partial_renovation", () => {
    const r = extractRequirements("リビングだけリフォームしたい", BASE_DATE);
    expect(r.workCategory).toBe("partial_renovation");
  });

  it("キーワードなし → other", () => {
    const r = extractRequirements("何かいろいろリフォームしてほしい", BASE_DATE);
    expect(r.workCategory).toBe("other");
  });
});

describe("requirement-extractor — workScale", () => {
  it("予算100万未満 → small", () => {
    const r = extractRequirements("予算50万円でお願いしたい", BASE_DATE);
    expect(r.workScale).toBe("small");
  });

  it("予算200万 → medium", () => {
    const r = extractRequirements("予算200万円を考えています", BASE_DATE);
    expect(r.workScale).toBe("medium");
  });

  it("予算800万 → large", () => {
    const r = extractRequirements("予算800万円でフルリノベ", BASE_DATE);
    expect(r.workScale).toBe("large");
  });

  it("予算3000万 → extra_large", () => {
    const r = extractRequirements("予算3000万円のリノベーション", BASE_DATE);
    expect(r.workScale).toBe("extra_large");
  });

  it("全面キーワードあり予算なし → large", () => {
    const r = extractRequirements("全面リノベーションをしたい", BASE_DATE);
    expect(r.workScale).toBe("large");
  });

  it("「一部」 → small", () => {
    const r = extractRequirements("一部だけ修繕してほしい", BASE_DATE);
    expect(r.workScale).toBe("small");
  });

  it("予算なし + 特段キーワードなし → medium", () => {
    const r = extractRequirements("キッチンのリフォームを相談したい", BASE_DATE);
    expect(r.workScale).toBe("medium");
  });
});

describe("requirement-extractor — locationCity", () => {
  it("「世田谷区」を検出", () => {
    const r = extractRequirements("世田谷区にある自宅のリフォーム", BASE_DATE);
    expect(r.locationCity).toBe("世田谷区");
  });

  it("「渋谷区」を検出", () => {
    const r = extractRequirements("渋谷区のオフィス内装工事", BASE_DATE);
    expect(r.locationCity).toBe("渋谷区");
  });

  it("「目黒区」を検出", () => {
    const r = extractRequirements("目黒区の戸建てをリノベしたい", BASE_DATE);
    expect(r.locationCity).toBe("目黒区");
  });

  it("「新宿区」を検出", () => {
    const r = extractRequirements("新宿区のマンションリフォーム", BASE_DATE);
    expect(r.locationCity).toBe("新宿区");
  });

  it("地名なし → null", () => {
    const r = extractRequirements("キッチンをリフォームしたい", BASE_DATE);
    expect(r.locationCity).toBeNull();
  });
});

describe("requirement-extractor — desiredStartMonth", () => {
  it("「来月」 → 翌月", () => {
    const date = new Date("2026-05-09");
    const r = extractRequirements("来月から工事をお願いしたい", date);
    expect(r.desiredStartMonth).toBe(6); // 5月→6月
  });

  it("「3ヶ月後」 → 3ヶ月後の月", () => {
    const date = new Date("2026-05-09");
    const r = extractRequirements("3ヶ月後に開始したい", date);
    expect(r.desiredStartMonth).toBe(8); // 5+3=8月
  });

  it("「春」 → 4月", () => {
    const r = extractRequirements("春に始めたい", BASE_DATE);
    expect(r.desiredStartMonth).toBe(4);
  });

  it("「夏」 → 7月", () => {
    const r = extractRequirements("夏に工事したい", BASE_DATE);
    expect(r.desiredStartMonth).toBe(7);
  });

  it("「秋」 → 10月", () => {
    const r = extractRequirements("秋から始めたい", BASE_DATE);
    expect(r.desiredStartMonth).toBe(10);
  });

  it("「冬」 → 1月", () => {
    const r = extractRequirements("冬に工事予定", BASE_DATE);
    expect(r.desiredStartMonth).toBe(1);
  });

  it("「年内」 → 12月", () => {
    const r = extractRequirements("年内に完了させたい", BASE_DATE);
    expect(r.desiredStartMonth).toBe(12);
  });

  it("「年明け」 → 1月", () => {
    const r = extractRequirements("年明けから工事を開始したい", BASE_DATE);
    expect(r.desiredStartMonth).toBe(1);
  });

  it("月指定なし → null", () => {
    const r = extractRequirements("キッチンのリフォームについて", BASE_DATE);
    expect(r.desiredStartMonth).toBeNull();
  });
});

describe("requirement-extractor — contactPreference", () => {
  it("「メール」 → email", () => {
    const r = extractRequirements("メールで連絡してください", BASE_DATE);
    expect(r.contactPreference).toBe("email");
  });

  it("「電話」 → phone", () => {
    const r = extractRequirements("電話で折り返しお願いします", BASE_DATE);
    expect(r.contactPreference).toBe("phone");
  });

  it("「LINE」 → line", () => {
    const r = extractRequirements("LINEで連絡をお願いします", BASE_DATE);
    expect(r.contactPreference).toBe("line");
  });

  it("「Discord」 → discord", () => {
    const r = extractRequirements("Discordで連絡してほしいです", BASE_DATE);
    expect(r.contactPreference).toBe("discord");
  });

  it("連絡手段なし → null", () => {
    const r = extractRequirements("キッチンリフォームを相談したい", BASE_DATE);
    expect(r.contactPreference).toBeNull();
  });
});

describe("requirement-extractor — budgetHint", () => {
  it("「150万円」 → 1500000", () => {
    const r = extractRequirements("予算150万円でお願いします", BASE_DATE);
    expect(r.budgetHintJpy).toBe(1_500_000);
  });

  it("「500万」 → 5000000", () => {
    const r = extractRequirements("予算は500万くらいを想定しています", BASE_DATE);
    expect(r.budgetHintJpy).toBe(5_000_000);
  });

  it("金額なし → null", () => {
    const r = extractRequirements("キッチンリフォームをしたい", BASE_DATE);
    expect(r.budgetHintJpy).toBeNull();
  });
});

describe("requirement-extractor — 抽出失敗ケース (other)", () => {
  it("空文字列でも例外を投げない", () => {
    expect(() => extractRequirements("", BASE_DATE)).not.toThrow();
  });

  it("空文字列 → workCategory=other, workScale=medium", () => {
    const r = extractRequirements("", BASE_DATE);
    expect(r.workCategory).toBe("other");
    expect(r.workScale).toBe("medium");
    expect(r.locationCity).toBeNull();
    expect(r.budgetHintJpy).toBeNull();
    expect(r.desiredStartMonth).toBeNull();
    expect(r.contactPreference).toBeNull();
  });
});
