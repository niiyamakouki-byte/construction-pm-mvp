/**
 * InquiryInboxPage コンポーネントテスト
 *
 * データ源が localStorage (inquiry-store.ts) から Supabase 読み取り
 * (inquiry-inbox-repository.ts, authenticated) へ切り替わったため、
 * リポジトリをモックした fixture ベースのテストに書き換えた。
 * 削除・下書き保存(永続化)は RLS/スキーマ上サポートしないため廃止。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InquiryInboxPage } from "../InquiryInboxPage.js";
import type { ContactSubmission } from "../../lib/contact-webhook/contact-webhook-receiver.js";
import type { EstimateRange } from "../../lib/estimate-assistant/cost-lookup.js";
import type { InquiryDbRecord } from "../../lib/contact-webhook/inquiry-inbox-repository.js";

// ── ファクトリ ────────────────────────────────────────────────────────────────

function makeSubmission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  return {
    id: "inquiry-ui-1",
    name: "田中 花子",
    email: "tanaka@example.com",
    message: "LDK 15畳のリフォームを検討しています",
    source: "laporta-hp",
    timestamp: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

function makeEstimate(): EstimateRange {
  return {
    items: [],
    totalLow: 100000,
    totalMid: 120000,
    totalHigh: 150000,
    taxIncludedLow: 110000,
    taxIncludedMid: 132000,
    taxIncludedHigh: 165000,
  };
}

function makeRecord(overrides: Partial<InquiryDbRecord> = {}): InquiryDbRecord {
  return {
    id: "row-1",
    createdAt: "2026-05-09T10:00:00.000Z",
    source: "hp_contact",
    submission: makeSubmission(),
    estimate: makeEstimate(),
    status: "new",
    repliedAt: null,
    notes: null,
    ...overrides,
  };
}

// ── リポジトリモック ──────────────────────────────────────────────────────────

const listInquiriesMock = vi.fn();
const updateInquiryStatusMock = vi.fn();

vi.mock("../../lib/contact-webhook/inquiry-inbox-repository.js", () => ({
  listInquiries: (...args: unknown[]) => listInquiriesMock(...args),
  updateInquiryStatus: (...args: unknown[]) => updateInquiryStatusMock(...args),
}));

// ── セットアップ ──────────────────────────────────────────────────────────────

beforeEach(() => {
  listInquiriesMock.mockReset();
  updateInquiryStatusMock.mockReset();
  updateInquiryStatusMock.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: () => Promise.resolve() },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
});

// ── 表示テスト ─────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 表示", () => {
  it("問い合わせがない場合「問い合わせを選択してください」が表示される", async () => {
    listInquiriesMock.mockResolvedValue([]);
    render(<InquiryInboxPage />);
    expect(await screen.findByText("問い合わせを選択してください")).toBeDefined();
  });

  it("問い合わせがある場合リストに氏名が表示される (fixture 2件)", async () => {
    listInquiriesMock.mockResolvedValue([
      makeRecord({ id: "row-1", submission: makeSubmission({ name: "山田 太郎" }) }),
      makeRecord({ id: "row-2", submission: makeSubmission({ name: "鈴木 一郎" }) }),
    ]);
    render(<InquiryInboxPage />);
    expect(await screen.findByText("山田 太郎")).toBeDefined();
    expect(screen.getByText("鈴木 一郎")).toBeDefined();
  });

  it("ページタイトル「問い合わせ受信箱」が表示される", async () => {
    listInquiriesMock.mockResolvedValue([]);
    render(<InquiryInboxPage />);
    expect(await screen.findByText("問い合わせ受信箱")).toBeDefined();
  });

  it("新着件数バッジが表示される", async () => {
    listInquiriesMock.mockResolvedValue([
      makeRecord({ id: "row-1" }),
      makeRecord({ id: "row-2" }),
    ]);
    render(<InquiryInboxPage />);
    expect(await screen.findByText("2")).toBeDefined();
  });

  it("フィルタタブが全て表示される", async () => {
    listInquiriesMock.mockResolvedValue([]);
    render(<InquiryInboxPage />);
    await screen.findByText("問い合わせ受信箱");
    expect(screen.getByText("すべて")).toBeDefined();
    expect(screen.getByText("新着")).toBeDefined();
    expect(screen.getByText("返信済み")).toBeDefined();
    expect(screen.getByText("クローズ")).toBeDefined();
  });

  it("取得に失敗した場合エラーメッセージを表示する", async () => {
    listInquiriesMock.mockRejectedValue(new Error("network down"));
    render(<InquiryInboxPage />);
    expect(await screen.findByText("network down")).toBeDefined();
  });
});

// ── 選択 / 詳細表示 ───────────────────────────────────────────────────────────

describe("InquiryInboxPage — 詳細表示", () => {
  it("問い合わせをクリックすると詳細が表示される", async () => {
    listInquiriesMock.mockResolvedValue([
      makeRecord({ submission: makeSubmission({ name: "佐藤 次郎", message: "浴室のリフォームを検討中" }) }),
    ]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText("佐藤 次郎"));
    const elems = screen.getAllByText("浴室のリフォームを検討中");
    expect(elems.length).toBeGreaterThanOrEqual(1);
  });

  it("詳細に概算レンジ (梅/竹/松) が表示される", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    expect(screen.getByText("梅")).toBeDefined();
    expect(screen.getByText("竹")).toBeDefined();
    expect(screen.getByText("松")).toBeDefined();
  });

  it("詳細に「返信下書き」セクションが表示される", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    expect(screen.getByText("返信下書き")).toBeDefined();
  });

  it("詳細に「返信済みにマーク」ボタンが表示される", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    expect(screen.getByText("返信済みにマーク")).toBeDefined();
  });
});

// ── 状態遷移 ─────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 状態遷移", () => {
  it("「返信済みにマーク」をクリックすると updateInquiryStatus が replied で呼ばれ、再取得する", async () => {
    listInquiriesMock
      .mockResolvedValueOnce([makeRecord({ id: "row-1", status: "new" })])
      .mockResolvedValueOnce([makeRecord({ id: "row-1", status: "replied" })]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    fireEvent.click(screen.getByText("返信済みにマーク"));

    await waitFor(() => {
      expect(updateInquiryStatusMock).toHaveBeenCalledWith("row-1", "replied");
    });
    await waitFor(() => {
      expect(screen.getAllByText("返信済み").length).toBeGreaterThan(0);
    });
  });
});

// ── 下書き編集 ────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 下書き編集", () => {
  it("件名テキストボックスが編集できる", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    const subjectInput = screen.getByLabelText("件名") as HTMLInputElement;
    fireEvent.change(subjectInput, { target: { value: "新しい件名" } });
    expect(subjectInput.value).toBe("新しい件名");
  });

  it("本文テキストエリアが編集できる", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    const bodyArea = screen.getByLabelText("本文") as HTMLTextAreaElement;
    fireEvent.change(bodyArea, { target: { value: "編集された本文" } });
    expect(bodyArea.value).toBe("編集された本文");
  });

  it("「コピー」ボタンが存在する", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    fireEvent.click(await screen.findByText(/田中 花子/));
    expect(screen.getByText("コピー")).toBeDefined();
  });
});

// ── フィルタ ──────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — フィルタ", () => {
  it("「新着」タブでステータスが new の件だけ表示する", async () => {
    listInquiriesMock.mockResolvedValue([
      makeRecord({ id: "row-1", submission: makeSubmission({ name: "新着ユーザー" }), status: "new" }),
      makeRecord({ id: "row-2", submission: makeSubmission({ name: "返信済みユーザー" }), status: "replied" }),
    ]);
    render(<InquiryInboxPage />);
    await screen.findByText("新着ユーザー");
    fireEvent.click(screen.getByRole("button", { name: "新着" }));
    expect(screen.queryByText("新着ユーザー")).toBeDefined();
    expect(screen.queryByText("返信済みユーザー")).toBeNull();
  });

  it("「すべて」タブでリセットできる", async () => {
    listInquiriesMock.mockResolvedValue([makeRecord()]);
    render(<InquiryInboxPage />);
    await screen.findByText(/田中 花子/);
    fireEvent.click(screen.getByRole("button", { name: "返信済み" }));
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(screen.getByText(/田中 花子/)).toBeDefined();
  });
});
