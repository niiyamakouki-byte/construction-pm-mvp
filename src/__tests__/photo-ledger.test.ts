import { describe, it, expect } from "vitest";
import {
  buildPhotoLedgerHtml,
  buildPhotoLedgerMetadata,
  type PhotoLedgerEntry,
  type PhotoLedgerInput,
  type PhotoLedgerCoverInfo,
} from "../lib/photo-ledger.js";

// ── Fixtures ──────────────────────────────────────────────────────────────

const baseCover: PhotoLedgerCoverInfo = {
  projectName: "南青山テストビル 内装改修工事",
  projectNumber: "2024-001",
  startDate: "2024-04-01",
  endDate: "2024-06-30",
  orderer: "株式会社テスト発注者",
  contractor: "株式会社ラポルタ",
  location: "東京都港区南青山",
  createdAt: "2024-07-01",
};

function makeEntry(overrides: Partial<PhotoLedgerEntry> = {}): PhotoLedgerEntry {
  return {
    photoUrl: "https://example.com/photo.jpg",
    shootDate: "2024-04-15",
    category: "内装",
    comment: "施工前の状況",
    blackboardData: {
      workType: "クロス張り",
      location: "2F 会議室",
      condition: "施工前",
    },
    ...overrides,
  };
}

// ── Cover page tests ──────────────────────────────────────────────────────

describe("写真台帳 — 表紙", () => {
  it("工事名が表紙に含まれる", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("南青山テストビル 内装改修工事");
  });

  it("発注者・施工者が表紙に含まれる", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("株式会社テスト発注者");
    expect(html).toContain("株式会社ラポルタ");
  });

  it("着工日・竣工日が日本語形式で含まれる", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("2024年4月1日");
    expect(html).toContain("2024年6月30日");
  });

  it("CALS/EC 準拠表記が含まれる", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("CALS/EC");
  });

  it("titleタグに工事名が含まれる", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("<title>南青山テストビル 内装改修工事 — 写真台帳</title>");
  });
});

// ── Layout: 1枚/ページ ────────────────────────────────────────────────────

describe("レイアウト: 1枚/ページ", () => {
  it("photo-grid-1 クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry()],
      layout: 1,
    });
    expect(html).toContain("photo-grid-1");
  });

  it("3枚で3ページ生成される", () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 1 });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(3);
  });
});

// ── Layout: 2枚/ページ ────────────────────────────────────────────────────

describe("レイアウト: 2枚/ページ", () => {
  it("photo-grid-2 クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry(), makeEntry()],
      layout: 2,
    });
    expect(html).toContain("photo-grid-2");
  });

  it("4枚で2ページ生成される", () => {
    const entries = Array.from({ length: 4 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 2 });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });
});

// ── Layout: 4枚/ページ (デフォルト) ──────────────────────────────────────

describe("レイアウト: 4枚/ページ（デフォルト）", () => {
  it("layoutを省略するとphoto-grid-4が使われる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry()],
    });
    expect(html).toContain("photo-grid-4");
  });

  it("5枚で2ページ生成される（最終ページに空欄あり）", () => {
    const entries = Array.from({ length: 5 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 4 });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });

  it("空欄セルに（空欄）テキストが含まれる", () => {
    const entries = [makeEntry()]; // 1枚 → 4枚グリッドで3マス空欄
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 4 });
    expect(html).toContain("（空欄）");
  });
});

// ── Layout: 6枚/ページ ────────────────────────────────────────────────────

describe("レイアウト: 6枚/ページ", () => {
  it("photo-grid-6 クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: Array.from({ length: 6 }, () => makeEntry()),
      layout: 6,
    });
    expect(html).toContain("photo-grid-6");
  });

  it("7枚で2ページ生成される", () => {
    const entries = Array.from({ length: 7 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 6 });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });
});

// ── 写真キャプション ──────────────────────────────────────────────────────

describe("写真キャプション", () => {
  it("撮影日がキャプションに含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry({ shootDate: "2024-05-20" })],
    });
    expect(html).toContain("2024-05-20");
  });

  it("カテゴリがキャプションに含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry({ category: "外観" })],
    });
    expect(html).toContain("外観");
  });

  it("電子黒板データ（工種・部位・状況）が含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [
        makeEntry({
          blackboardData: {
            workType: "タイル張り",
            location: "1F ロビー",
            condition: "施工中",
          },
        }),
      ],
    });
    expect(html).toContain("タイル張り");
    expect(html).toContain("1F ロビー");
    expect(html).toContain("施工中");
  });

  it("備考コメントが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry({ comment: "特記事項テスト" })],
    });
    expect(html).toContain("特記事項テスト");
  });

  it("blackboardDataなしでもエラーにならない", () => {
    const entry = makeEntry();
    delete (entry as Partial<PhotoLedgerEntry>).blackboardData;
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [entry] });
    expect(html).toContain("photo-cell");
  });
});

// ── メタデータ ────────────────────────────────────────────────────────────

describe("buildPhotoLedgerMetadata — CALS/EC メタデータ", () => {
  it("CALS/EC standardとversionが正しい", () => {
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries: [] });
    expect(meta.standard).toBe("CALS/EC");
    expect(meta.version).toBe("4.0");
  });

  it("工事名・施工者が含まれる", () => {
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries: [] });
    expect(meta.projectName).toBe("南青山テストビル 内装改修工事");
    expect(meta.contractorName).toBe("株式会社ラポルタ");
  });

  it("写真枚数が正しくカウントされる", () => {
    const entries = Array.from({ length: 7 }, () => makeEntry());
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries });
    expect(meta.photoCount).toBe(7);
  });

  it("カテゴリが重複なしでリストアップされる", () => {
    const entries = [
      makeEntry({ category: "外観" }),
      makeEntry({ category: "内装" }),
      makeEntry({ category: "外観" }),
      makeEntry({ category: "設備" }),
    ];
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries });
    expect(meta.categories).toHaveLength(3);
    expect(meta.categories).toContain("外観");
    expect(meta.categories).toContain("内装");
    expect(meta.categories).toContain("設備");
  });

  it("createdAtがISO日時形式である", () => {
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries: [] });
    expect(meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── Layout: 3-per-page ────────────────────────────────────────────────────

describe("レイアウト: 3枚/ページ（3-per-page）", () => {
  it("photo-grid-3-per-page クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: Array.from({ length: 3 }, () => makeEntry()),
      layout: "3-per-page",
    });
    expect(html).toContain("photo-grid-3-per-page");
  });

  it("3枚で1ページ生成される", () => {
    const entries = Array.from({ length: 3 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "3-per-page" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(1);
  });

  it("4枚で2ページ生成される", () => {
    const entries = Array.from({ length: 4 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "3-per-page" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });

  it("写真のキャプション情報が含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry({ comment: "3枚レイアウトテスト" })],
      layout: "3-per-page",
    });
    expect(html).toContain("3枚レイアウトテスト");
  });
});

// ── Layout: 2-landscape ───────────────────────────────────────────────────

describe("レイアウト: 2枚横長（2-landscape）", () => {
  it("photo-grid-2-landscape クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: Array.from({ length: 2 }, () => makeEntry()),
      layout: "2-landscape",
    });
    expect(html).toContain("photo-grid-2-landscape");
  });

  it("2枚で1ページ生成される", () => {
    const entries = Array.from({ length: 2 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "2-landscape" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(1);
  });

  it("3枚で2ページ生成される", () => {
    const entries = Array.from({ length: 3 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "2-landscape" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });
});

// ── Layout: 1-with-detail ─────────────────────────────────────────────────

describe("レイアウト: 1枚+詳細情報欄（1-with-detail）", () => {
  it("photo-grid-1-with-detail クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry()],
      layout: "1-with-detail",
    });
    expect(html).toContain("photo-grid-1-with-detail");
  });

  it("detail-info-panel が含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry()],
      layout: "1-with-detail",
    });
    expect(html).toContain("detail-info-panel");
  });

  it("電子黒板データが詳細パネルに含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [
        makeEntry({
          blackboardData: {
            workType: "クロス張り詳細",
            location: "3F 会議室",
            condition: "施工後",
          },
        }),
      ],
      layout: "1-with-detail",
    });
    expect(html).toContain("クロス張り詳細");
    expect(html).toContain("3F 会議室");
    expect(html).toContain("施工後");
  });

  it("1枚で1ページ、3枚で3ページ生成される", () => {
    const entries = Array.from({ length: 3 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "1-with-detail" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(3);
  });

  it("備考コメントが詳細パネルに含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry({ comment: "詳細レイアウトコメントテスト" })],
      layout: "1-with-detail",
    });
    expect(html).toContain("詳細レイアウトコメントテスト");
  });
});

// ── Layout: comparison ────────────────────────────────────────────────────

describe("レイアウト: Before/After比較（comparison）", () => {
  it("photo-grid-comparison クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: Array.from({ length: 2 }, () => makeEntry()),
      layout: "comparison",
    });
    expect(html).toContain("photo-grid-comparison");
  });

  it("Before/Afterラベルが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: Array.from({ length: 2 }, () => makeEntry()),
      layout: "comparison",
    });
    expect(html).toContain("Before（施工前）");
    expect(html).toContain("After（施工後）");
  });

  it("2枚で1ページ生成される", () => {
    const entries = Array.from({ length: 2 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "comparison" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(1);
  });

  it("4枚で2ページ生成される", () => {
    const entries = Array.from({ length: 4 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: "comparison" });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(2);
  });

  it("comparison-label クラスが含まれる", () => {
    const html = buildPhotoLedgerHtml({
      cover: baseCover,
      entries: [makeEntry()],
      layout: "comparison",
    });
    expect(html).toContain("comparison-label");
  });
});

// ── エッジケース ──────────────────────────────────────────────────────────

describe("エッジケース", () => {
  it("entriesが空でも正常なHTMLを返す", () => {
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [] });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("写真台帳");
    expect(html).toContain("写真が登録されていません");
  });

  it("HTMLインジェクション文字がエスケープされる", () => {
    const cover: PhotoLedgerCoverInfo = {
      ...baseCover,
      projectName: "<script>alert('xss')</script>",
    };
    const html = buildPhotoLedgerHtml({ cover, entries: [] });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("大量データ（100枚、4枚/ページ）で25ページ生成される", () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ shootDate: `2024-04-${String((i % 28) + 1).padStart(2, "0")}` }),
    );
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 4 });
    const matches = html.match(/class="ledger-page"/g);
    expect(matches).toHaveLength(25);
  });

  it("大量データ（100枚）でメタデータの枚数が正しい", () => {
    const entries = Array.from({ length: 100 }, () => makeEntry());
    const meta = buildPhotoLedgerMetadata({ cover: baseCover, entries });
    expect(meta.photoCount).toBe(100);
  });

  it("createdAtなしでも現在時刻でメタデータが生成される", () => {
    const cover: PhotoLedgerCoverInfo = { projectName: "テスト工事" };
    const meta = buildPhotoLedgerMetadata({ cover, entries: [] });
    expect(meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(meta.contractorName).toBe("");
  });

  it("photoUrlの特殊文字がエスケープされる", () => {
    const entry = makeEntry({ photoUrl: 'https://example.com/photo?a=1&b=2">' });
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries: [entry] });
    expect(html).not.toContain('">"');
    expect(html).toContain("&amp;");
  });

  it("ページ番号が正しく表示される", () => {
    const entries = Array.from({ length: 8 }, () => makeEntry());
    const html = buildPhotoLedgerHtml({ cover: baseCover, entries, layout: 4 });
    expect(html).toContain("第 1 / 2 頁");
    expect(html).toContain("第 2 / 2 頁");
  });
});
