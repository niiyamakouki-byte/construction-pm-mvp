/**
 * カオステスト — 今日追加した新機能の耐障害テスト
 * 不正入力・境界値・大量データ・特殊文字・状態遷移エラーを網羅する
 */
import { describe, beforeEach, expect, it } from "vitest";

// correction-workflow
import {
  clearCorrections,
  createCorrection,
  notifyAssignee,
  startCorrection,
  submitCorrection,
  approveCorrection,
  rejectCorrection,
} from "../lib/correction-workflow.js";

// finish-inspection
import {
  clearInspections,
  createRoomInspection,
  addInspectionItem,
  buildFinishInspectionHtml,
} from "../lib/finish-inspection.js";

// crew-board
import {
  _resetCrewBoard,
  addCrewMember,
  addAssignment,
  checkConflict,
} from "../lib/crew-board.js";

// deal-profit-tracker
import {
  clearDeals,
  createDeal,
  getAllDeals,
  addChangeOrder,
  getGrossProfit,
  getActualGrossProfit,
  getGrossProfitRate,
  type DealProfit,
} from "../lib/deal-profit-tracker.js";

// e-contract
import {
  clearContracts,
  createContract,
  sendContract,
  markViewed,
  signContract,
  expireContracts,
} from "../lib/e-contract.js";

// photo-ledger
import {
  buildPhotoLedgerHtml,
  type PhotoLedgerInput,
} from "../lib/photo-ledger.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDeal(overrides: Partial<DealProfit> = {}): DealProfit {
  return {
    id: `deal-${Math.random().toString(36).slice(2)}`,
    projectId: "proj-1",
    projectName: "テスト現場",
    clientName: "テスト施主",
    phase: "引合",
    estimatedRevenue: 1_000_000,
    estimatedCost: 700_000,
    actualRevenue: 0,
    actualCost: 0,
    changeOrders: [],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── 1. correction-workflow ────────────────────────────────────────────────────

describe("chaos: correction-workflow", () => {
  beforeEach(() => {
    clearCorrections();
  });

  it("存在しないIDへの notifyAssignee はエラーをスロー", () => {
    expect(() => notifyAssignee("nonexistent-id")).toThrow();
  });

  it("存在しないIDへの approveCorrection はエラーをスロー", () => {
    expect(() => approveCorrection("ghost-id")).toThrow();
  });

  it("不正状態遷移: open → approved は直接できない", () => {
    const item = createCorrection({
      projectId: "p1",
      title: "テスト",
      description: "詳細",
      assignee: "担当者",
      reporter: "報告者",
      photos: {},
      dueDate: "2026-05-01",
    });
    expect(() => approveCorrection(item.id)).toThrow(/遷移不可/);
  });

  it("不正状態遷移: rejected から rejectCorrection は再度エラー", () => {
    const item = createCorrection({
      projectId: "p1",
      title: "タイル浮き",
      description: "詳細",
      assignee: "山田",
      reporter: "佐藤",
      photos: {},
      dueDate: "2026-05-01",
    });
    notifyAssignee(item.id);
    rejectCorrection(item.id);
    // rejected → rejected は不可
    expect(() => rejectCorrection(item.id)).toThrow(/遷移不可/);
  });

  it("空文字タイトルでも createCorrection は登録できる（バリデーションなし）", () => {
    const item = createCorrection({
      projectId: "p1",
      title: "",
      description: "",
      assignee: "",
      reporter: "",
      photos: {},
      dueDate: "",
    });
    expect(item.id).toBeTruthy();
    expect(item.title).toBe("");
  });

  it("approved から startCorrection を試みるとエラー", () => {
    const item = createCorrection({
      projectId: "p1",
      title: "壁クラック",
      description: "詳細",
      assignee: "A",
      reporter: "B",
      photos: {},
      dueDate: "2026-06-01",
    });
    notifyAssignee(item.id);
    startCorrection(item.id);
    submitCorrection(item.id);
    approveCorrection(item.id);
    expect(() => startCorrection(item.id)).toThrow(/遷移不可/);
  });
});

// ─── 2. finish-inspection ──────────────────────────────────────────────────────

describe("chaos: finish-inspection", () => {
  beforeEach(() => {
    clearInspections();
  });

  it("XSS文字列をコメントに含めてもHTMLがエスケープされている", () => {
    const xss = '<script>alert("xss")</script>';
    const insp = createRoomInspection({
      projectId: "p1",
      roomName: xss,
      floor: "1F",
      inspectionDate: "2026-04-12",
      inspector: "検査員",
    });
    addInspectionItem(insp.id, {
      category: "天井仕上",
      description: xss,
      status: "ng",
      photos: [],
      comment: xss,
    });
    const html = buildFinishInspectionHtml("p1", xss);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("大量アイテム(500件)を追加してもHTMLが生成できる", () => {
    const insp = createRoomInspection({
      projectId: "p2",
      roomName: "大部屋",
      floor: "2F",
      inspectionDate: "2026-04-12",
      inspector: "検査員",
    });
    for (let i = 0; i < 500; i++) {
      addInspectionItem(insp.id, {
        category: "その他",
        description: `アイテム${i}`,
        status: i % 3 === 0 ? "ng" : "ok",
        photos: [],
        comment: "",
      });
    }
    const html = buildFinishInspectionHtml("p2", "大部屋プロジェクト");
    expect(html).toContain("大部屋");
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("存在しないIDへの addInspectionItem はエラーをスロー", () => {
    expect(() =>
      addInspectionItem("nonexistent", {
        category: "天井仕上",
        description: "test",
        status: "ok",
        photos: [],
        comment: "",
      }),
    ).toThrow();
  });

  it("検査データ0件でもHTMLが生成できる（空部屋）", () => {
    const html = buildFinishInspectionHtml("empty-project", "空プロジェクト");
    expect(html).toContain("検査データなし");
  });
});

// ─── 3. crew-board ────────────────────────────────────────────────────────────

describe("chaos: crew-board", () => {
  beforeEach(() => {
    _resetCrewBoard();
  });

  it("ダブルブッキング100件: checkConflict が全件検出する", () => {
    const member = addCrewMember({
      name: "田中太郎",
      company: "田中組",
      jobType: "大工",
      skills: [],
    });
    const date = "2026-04-15";
    // 最初のアサイン
    addAssignment({
      memberId: member.id,
      projectId: "proj-A",
      projectName: "A現場",
      date,
    });
    // 追加99件（同一メンバー・同日・別プロジェクト）
    for (let i = 1; i < 100; i++) {
      addAssignment({
        memberId: member.id,
        projectId: `proj-${i}`,
        projectName: `現場${i}`,
        date,
      });
    }
    const conflicts = checkConflict(member.id, date);
    // 全100件が存在し、重複が検出されている
    expect(conflicts.length).toBe(100);
  });

  it("過去日付でアサインメントが登録できる", () => {
    const member = addCrewMember({
      name: "過去の職人",
      company: "昔の会社",
      jobType: "塗装",
      skills: [],
    });
    const assignment = addAssignment({
      memberId: member.id,
      projectId: "old-proj",
      projectName: "過去現場",
      date: "2020-01-01",
    });
    expect(assignment.date).toBe("2020-01-01");
  });

  it("未来日付でアサインメントが登録できる", () => {
    const member = addCrewMember({
      name: "未来の職人",
      company: "未来組",
      jobType: "電気",
      skills: [],
    });
    const assignment = addAssignment({
      memberId: member.id,
      projectId: "future-proj",
      projectName: "未来現場",
      date: "2099-12-31",
    });
    expect(assignment.date).toBe("2099-12-31");
  });

  it("特殊文字を含むメンバー名が登録できる", () => {
    const specialName = "<田中> & \"佐藤\" '山田'";
    const member = addCrewMember({
      name: specialName,
      company: "特殊組",
      jobType: "内装",
      skills: [],
    });
    expect(member.name).toBe(specialName.trim());
  });

  it("空文字メンバー名は addCrewMember でエラーをスロー", () => {
    expect(() =>
      addCrewMember({
        name: "   ",
        company: "会社",
        jobType: "大工",
        skills: [],
      }),
    ).toThrow("name is required");
  });

  it("memberId 未指定 addAssignment はエラーをスロー", () => {
    expect(() =>
      addAssignment({
        memberId: "",
        projectId: "proj-1",
        projectName: "現場",
        date: "2026-04-12",
      }),
    ).toThrow("memberId is required");
  });
});

// ─── 4. deal-profit-tracker ───────────────────────────────────────────────────

describe("chaos: deal-profit-tracker", () => {
  beforeEach(() => {
    clearDeals();
  });

  it("MAX_SAFE_INTEGER 金額でもクラッシュしない", () => {
    const deal = makeDeal({
      estimatedRevenue: Number.MAX_SAFE_INTEGER,
      estimatedCost: Number.MAX_SAFE_INTEGER - 1,
    });
    createDeal(deal);
    const profit = getGrossProfit(deal);
    expect(profit).toBe(1);
  });

  it("負数金額（マイナス原価）でも粗利計算が動作する", () => {
    const deal = makeDeal({
      estimatedRevenue: 5_000_000,
      estimatedCost: -500_000,
    });
    createDeal(deal);
    const profit = getGrossProfit(deal);
    expect(profit).toBe(5_500_000);
  });

  it("変更注文を大量(200件)追加しても実績粗利が計算できる", () => {
    const deal = makeDeal({
      actualRevenue: 10_000_000,
      actualCost: 7_000_000,
    });
    createDeal(deal);

    for (let i = 0; i < 200; i++) {
      addChangeOrder(deal.id, {
        id: `co-${i}`,
        description: `変更注文${i}`,
        amount: 1_000,
        type: i % 2 === 0 ? "revenue" : "cost",
        approvedAt: "2026-04-12T00:00:00.000Z",
      });
    }

    // 最新のdealオブジェクトを取得して検証
    const updated = getAllDeals().find((d) => d.id === deal.id)!;
    const profit = getActualGrossProfit(updated);
    // 100件revenue (100 * 1000 = +100,000) / 100件cost (100 * 1000 = -100,000)
    expect(profit).toBe(3_000_000); // 10M - 7M + 100K - 100K
  });

  it("売上0の案件で粗利率は0になる", () => {
    const deal = makeDeal({ estimatedRevenue: 0, estimatedCost: 0 });
    createDeal(deal);
    expect(getGrossProfitRate(deal)).toBe(0);
  });

  it("存在しないIDへの addChangeOrder は null を返す", () => {
    const result = addChangeOrder("nonexistent-deal-id", {
      id: "co-1",
      description: "変更",
      amount: 100,
      type: "revenue",
      approvedAt: "2026-04-12T00:00:00.000Z",
    });
    expect(result).toBeNull();
  });
});

// ─── 5. e-contract ────────────────────────────────────────────────────────────

describe("chaos: e-contract", () => {
  beforeEach(() => {
    clearContracts();
  });

  it("期限切れ状態(expired)から signContract を試みるとエラー", () => {
    const contract = createContract(
      "proj-1",
      "工事契約",
      [
        { name: "ラポルタ", email: "issuer@laporta.co.jp", role: "issuer" },
        { name: "施主A", email: "signer@client.co.jp", role: "signer" },
      ],
      "2020-01-01T00:00:00.000Z",
    );
    sendContract(contract.id);
    markViewed(contract.id);
    // 手動で期限切れにする
    expireContracts("2025-01-01T00:00:00.000Z");
    // expired → signed は不可
    expect(() => signContract(contract.id, "signer@client.co.jp")).toThrow(/Invalid transition/);
  });

  it("署名済み(signed)契約への再署名はエラー", () => {
    const contract = createContract(
      "proj-2",
      "追加工事契約",
      [
        { name: "ラポルタ", email: "issuer@laporta.co.jp", role: "issuer" },
        { name: "施主B", email: "signer2@client.co.jp", role: "signer" },
      ],
      "2099-01-01T00:00:00.000Z",
    );
    sendContract(contract.id);
    markViewed(contract.id);
    signContract(contract.id, "signer2@client.co.jp");
    // signed → signed は不可
    expect(() => signContract(contract.id, "signer2@client.co.jp")).toThrow(/Invalid transition/);
  });

  it("空のpartiesでも契約が作成できる", () => {
    const contract = createContract(
      "proj-3",
      "空partiesテスト",
      [],
      "2099-01-01T00:00:00.000Z",
    );
    expect(contract.id).toBeTruthy();
    expect(contract.parties).toHaveLength(0);
  });

  it("存在しないIDへの sendContract はエラーをスロー", () => {
    expect(() => sendContract("ghost-contract-id")).toThrow(/Contract not found/);
  });

  it("draft 状態のまま signContract を試みるとエラー（sent/viewed を経ないと署名不可）", () => {
    const contract = createContract(
      "proj-4",
      "直接署名テスト",
      [
        { name: "ラポルタ", email: "issuer@laporta.co.jp", role: "issuer" },
        { name: "施主C", email: "signer3@client.co.jp", role: "signer" },
      ],
      "2099-01-01T00:00:00.000Z",
    );
    expect(() => signContract(contract.id, "signer3@client.co.jp")).toThrow(/Invalid transition/);
  });

  it("expireContracts: viewed 状態の契約が期限超過で expired になる", () => {
    const contract = createContract(
      "proj-5",
      "期限テスト",
      [{ name: "ラポルタ", email: "issuer@laporta.co.jp", role: "issuer" }],
      "2025-01-01T00:00:00.000Z",
    );
    sendContract(contract.id);
    markViewed(contract.id);
    const expired = expireContracts("2026-01-01T00:00:00.000Z");
    expect(expired.some((c) => c.id === contract.id)).toBe(true);
    expect(expired.find((c) => c.id === contract.id)?.status).toBe("expired");
  });
});

// ─── 6. photo-ledger ──────────────────────────────────────────────────────────

describe("chaos: photo-ledger", () => {
  const baseCover = {
    projectName: "テスト現場",
    projectNumber: "2026-001",
    contractor: "ラポルタ",
  };

  it("0枚の写真でHTMLが生成できる（エラーなし）", () => {
    const input: PhotoLedgerInput = {
      cover: baseCover,
      entries: [],
      layout: 4,
    };
    const html = buildPhotoLedgerHtml(input);
    expect(html).toContain("写真が登録されていません");
    expect(html).toContain("DOCTYPE html");
  });

  it("大量(1000枚)の写真でHTMLが生成できる", () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({
      photoUrl: `https://example.com/photo-${i}.jpg`,
      shootDate: "2026-04-12",
      category: "着工前" as const,
      comment: `写真${i}のコメント`,
    }));
    const input: PhotoLedgerInput = {
      cover: baseCover,
      entries,
      layout: 6,
    };
    const html = buildPhotoLedgerHtml(input);
    expect(html).toContain("DOCTYPE html");
    expect(html.length).toBeGreaterThan(10000);
  });

  it("XSSコメントをHTMLエスケープする", () => {
    const xssComment = '<img src=x onerror=alert(1)>';
    const xssProject = '"><script>alert("xss")</script>';
    const input: PhotoLedgerInput = {
      cover: { ...baseCover, projectName: xssProject },
      entries: [
        {
          photoUrl: "https://example.com/photo.jpg",
          shootDate: "2026-04-12",
          category: "施工中" as const,
          comment: xssComment,
        },
      ],
      layout: 1,
    };
    const html = buildPhotoLedgerHtml(input);
    // <script> タグは生のHTMLとして出力されていないこと
    expect(html).not.toContain("<script>");
    // <img onerror> の形でHTMLタグとして出力されていないこと（エスケープ済み）
    expect(html).not.toContain("<img src=x onerror");
    // エスケープされた形で含まれていること
    expect(html).toContain("&lt;img src=x onerror");
  });

  it("layout=1 で単枚表示のHTMLが生成できる", () => {
    const input: PhotoLedgerInput = {
      cover: baseCover,
      entries: [
        {
          photoUrl: "https://example.com/photo.jpg",
          shootDate: "2026-04-12",
          category: "完成" as const,
        },
      ],
      layout: 1,
    };
    const html = buildPhotoLedgerHtml(input);
    expect(html).toContain("photo-grid-1");
  });

  it("layout=2 で2枚表示のHTMLが生成できる", () => {
    const input: PhotoLedgerInput = {
      cover: baseCover,
      entries: [
        {
          photoUrl: "https://example.com/a.jpg",
          shootDate: "2026-04-12",
          category: "着工前" as const,
        },
        {
          photoUrl: "https://example.com/b.jpg",
          shootDate: "2026-04-12",
          category: "着工前" as const,
        },
      ],
      layout: 2,
    };
    const html = buildPhotoLedgerHtml(input);
    expect(html).toContain("photo-grid-2");
  });
});
