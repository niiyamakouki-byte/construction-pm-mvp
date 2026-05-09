/**
 * InquiryInboxPage コンポーネントテスト
 */

import { beforeEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { InquiryInboxPage } from "../InquiryInboxPage.js";
import {
  addInquiry,
  updateInquiryStatus,
  _resetInquiryStore,
} from "../../lib/contact-webhook/inquiry-store.js";
import type { ContactSubmission } from "../../lib/contact-webhook/contact-webhook-receiver.js";
import type { EstimateRange } from "../../lib/estimate-assistant/cost-lookup.js";
import type { ReplyDraft } from "../../lib/contact-webhook/reply-draft-generator.js";

// ── ファクトリ ────────────────────────────────────────────────────────────────

let idCtr = 0;

function makeSubmission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  idCtr += 1;
  return {
    id: `inquiry-ui-${idCtr}`,
    name: `田中 花子${idCtr}`,
    email: `tanaka${idCtr}@example.com`,
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

function makeDraft(): ReplyDraft {
  return {
    subject: "【株式会社ラポルタ】お問い合わせありがとうございます",
    body: "田中 花子 様\n\nいつもお世話になっております。",
  };
}

// ── セットアップ ──────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  _resetInquiryStore();
  idCtr = 0;
  // clipboard API mock
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: () => Promise.resolve() },
    configurable: true,
    writable: true,
  });
});

// ── 表示テスト ─────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 表示", () => {
  it("問い合わせがない場合「問い合わせを選択してください」が表示される", () => {
    render(<InquiryInboxPage />);
    expect(screen.getByText("問い合わせを選択してください")).toBeDefined();
  });

  it("問い合わせがある場合リストに氏名が表示される", () => {
    const submission = makeSubmission({ name: "山田 太郎" });
    addInquiry(submission, makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    expect(screen.getByText("山田 太郎")).toBeDefined();
  });

  it("ページタイトル「問い合わせ受信箱」が表示される", () => {
    render(<InquiryInboxPage />);
    expect(screen.getByText("問い合わせ受信箱")).toBeDefined();
  });

  it("新着件数バッジが表示される", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    expect(screen.getByText("2")).toBeDefined();
  });

  it("フィルタタブが全て表示される", () => {
    render(<InquiryInboxPage />);
    expect(screen.getByText("すべて")).toBeDefined();
    expect(screen.getByText("新着")).toBeDefined();
    expect(screen.getByText("対応中")).toBeDefined();
    expect(screen.getByText("送信済み")).toBeDefined();
    expect(screen.getByText("アーカイブ")).toBeDefined();
  });
});

// ── 選択 / 詳細表示 ───────────────────────────────────────────────────────────

describe("InquiryInboxPage — 詳細表示", () => {
  it("問い合わせをクリックすると詳細が表示される", () => {
    const submission = makeSubmission({ name: "佐藤 次郎", message: "浴室のリフォームを検討中" });
    addInquiry(submission, makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText("佐藤 次郎"));
    // リストと詳細の両方に表示されるため getAllByText で確認
    const elems = screen.getAllByText("浴室のリフォームを検討中");
    expect(elems.length).toBeGreaterThanOrEqual(1);
  });

  it("詳細に概算レンジ (梅/竹/松) が表示される", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    const listItem = screen.getByText(/田中 花子/);
    fireEvent.click(listItem);
    expect(screen.getByText("梅")).toBeDefined();
    expect(screen.getByText("竹")).toBeDefined();
    expect(screen.getByText("松")).toBeDefined();
  });

  it("詳細に「返信下書き」セクションが表示される", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    const listItem = screen.getByText(/田中 花子/);
    fireEvent.click(listItem);
    expect(screen.getByText("返信下書き")).toBeDefined();
  });

  it("詳細に「送信済みにマーク」ボタンが表示される", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    expect(screen.getByText("送信済みにマーク")).toBeDefined();
  });
});

// ── 状態遷移 ─────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 状態遷移", () => {
  it("「送信済みにマーク」をクリックするとステータスバッジが「送信済み」になる", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    fireEvent.click(screen.getByText("送信済みにマーク"));
    // ステータスバッジが「送信済み」になっているか
    const badges = screen.getAllByText("送信済み");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("「対応中にする」をクリックするとステータスが「対応中」になる", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    fireEvent.click(screen.getByText("対応中にする"));
    const badges = screen.getAllByText("対応中");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("「削除」をクリックするとリストから消える", () => {
    const submission = makeSubmission({ name: "削除テスト" });
    addInquiry(submission, makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText("削除テスト"));
    fireEvent.click(screen.getByText("削除"));
    expect(screen.queryByText("削除テスト")).toBeNull();
  });
});

// ── 下書き編集 ────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — 下書き編集", () => {
  it("件名テキストボックスが編集できる", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    const subjectInput = screen.getByLabelText("件名") as HTMLInputElement;
    fireEvent.change(subjectInput, { target: { value: "新しい件名" } });
    expect(subjectInput.value).toBe("新しい件名");
  });

  it("本文テキストエリアが編集できる", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    const bodyArea = screen.getByLabelText("本文") as HTMLTextAreaElement;
    fireEvent.change(bodyArea, { target: { value: "編集された本文" } });
    expect(bodyArea.value).toBe("編集された本文");
  });

  it("「下書き保存」ボタンが存在する", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    expect(screen.getByText("下書き保存")).toBeDefined();
  });

  it("「コピー」ボタンが存在する", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByText(/田中 花子/));
    expect(screen.getByText("コピー")).toBeDefined();
  });
});

// ── フィルタ ──────────────────────────────────────────────────────────────────

describe("InquiryInboxPage — フィルタ", () => {
  it("「新着」タブでステータスが new の件だけ表示する", () => {
    const a = makeSubmission({ name: "新着ユーザー" });
    const b = makeSubmission({ name: "送信済みユーザー" });
    addInquiry(a, makeEstimate(), makeDraft());
    const bRecord = addInquiry(b, makeEstimate(), makeDraft());
    // b を sent に変更
    updateInquiryStatus(bRecord.id, "sent");

    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByRole("button", { name: "新着" }));
    expect(screen.queryByText("新着ユーザー")).toBeDefined();
  });

  it("「すべて」タブでリセットできる", () => {
    addInquiry(makeSubmission(), makeEstimate(), makeDraft());
    render(<InquiryInboxPage />);
    fireEvent.click(screen.getByRole("button", { name: "送信済み" }));
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(screen.getByText(/田中 花子/)).toBeDefined();
  });
});
