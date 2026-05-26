/**
 * Tests for danger-signals detection logic.
 */

import { describe, expect, it } from "vitest";
import {
  detectDangerSignals,
  DangerSignalKind,
  type ProjectDangerInput,
} from "../lib/exec-dashboard/danger-signals.js";
import type { Project, Task, Invoice, ChatMessage, Photo } from "../domain/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const TODAY = "2025-06-01";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "南青山リノベ",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    budget: 10_000_000,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    projectId: "proj-1",
    name: "工事タスク",
    description: "",
    status: "in_progress",
    progress: 50,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> & Pick<Invoice, "id">): Invoice {
  return {
    projectId: "proj-1",
    invoiceNumber: "INV-001",
    amount: 500_000,
    status: "sent",
    issueDate: "2025-01-01",
    dueDate: "2025-02-01",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeChat(overrides: Partial<ChatMessage> & Pick<ChatMessage, "id">): ChatMessage {
  return {
    projectId: "proj-1",
    userId: "user-1",
    userName: "田中",
    content: "こんにちは",
    timestamp: "2025-05-25T10:00:00Z",
    ...overrides,
  };
}

function makePhoto(overrides: Partial<Photo> & Pick<Photo, "id">): Photo {
  return {
    projectId: "proj-1",
    url: "https://example.com/photo.jpg",
    createdAt: "2025-05-25T10:00:00Z",
    updatedAt: "2025-05-25T10:00:00Z",
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProjectDangerInput> = {}): ProjectDangerInput {
  return {
    project: makeProject(),
    tasks: [],
    invoices: [],
    chatMessages: [],
    photos: [],
    today: TODAY,
    ...overrides,
  };
}

// ── delayedSchedule ────────────────────────────────────────────────────────

describe("detectDangerSignals — delayedSchedule", () => {
  it("遅延なし (dueDate未来) → シグナルなし", () => {
    const task = makeTask({ id: "t1", dueDate: "2025-06-15", status: "in_progress" });
    const signals = detectDangerSignals(baseInput({ tasks: [task] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.delayedSchedule)).toBeUndefined();
  });

  it("遅延 3日以内 → シグナルなし", () => {
    const task = makeTask({ id: "t1", dueDate: "2025-05-29", status: "in_progress" });
    const signals = detectDangerSignals(baseInput({ tasks: [task] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.delayedSchedule)).toBeUndefined();
  });

  it("遅延 4日 → delayedSchedule シグナルあり", () => {
    const task = makeTask({ id: "t1", dueDate: "2025-05-28", status: "in_progress" });
    const signals = detectDangerSignals(baseInput({ tasks: [task] }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.delayedSchedule);
    expect(sig).toBeDefined();
    expect(sig?.detail).toMatch(/4日/);
  });

  it("done タスクは遅延カウントしない", () => {
    const task = makeTask({ id: "t1", dueDate: "2025-01-01", status: "done" });
    const signals = detectDangerSignals(baseInput({ tasks: [task] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.delayedSchedule)).toBeUndefined();
  });

  it("最大遅延タスクの日数を使う (複数タスク)", () => {
    const tasks = [
      makeTask({ id: "t1", dueDate: "2025-05-25", status: "in_progress" }), // 7日遅延
      makeTask({ id: "t2", dueDate: "2025-05-20", status: "in_progress" }), // 12日遅延
    ];
    const signals = detectDangerSignals(baseInput({ tasks }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.delayedSchedule);
    expect(sig?.detail).toMatch(/12日/);
  });
});

// ── budgetOverrun ──────────────────────────────────────────────────────────

describe("detectDangerSignals — budgetOverrun", () => {
  it("EAC が契約額ちょうど → シグナルなし", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 10_000_000, eac: 10_000_000 }),
    );
    expect(signals.find((s) => s.kind === DangerSignalKind.budgetOverrun)).toBeUndefined();
  });

  it("EAC が 5% 超過以内 → シグナルなし", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 10_000_000, eac: 10_500_000 }),
    );
    expect(signals.find((s) => s.kind === DangerSignalKind.budgetOverrun)).toBeUndefined();
  });

  it("EAC が 5% を超過 → budgetOverrun シグナルあり", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 10_000_000, eac: 10_600_000 }),
    );
    const sig = signals.find((s) => s.kind === DangerSignalKind.budgetOverrun);
    expect(sig).toBeDefined();
    expect(sig?.detail).toMatch(/6%/);
  });

  it("EAC や contractAmount が 0 → シグナルなし", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 0, eac: 999_999 }),
    );
    expect(signals.find((s) => s.kind === DangerSignalKind.budgetOverrun)).toBeUndefined();
  });
});

// ── overdueInvoice ─────────────────────────────────────────────────────────

describe("detectDangerSignals — overdueInvoice", () => {
  it("30日以内延滞 → シグナルなし", () => {
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-05-02", status: "sent" });
    const signals = detectDangerSignals(baseInput({ invoices: [inv] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.overdueInvoice)).toBeUndefined();
  });

  it("31日超延滞 → overdueInvoice シグナルあり", () => {
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-04-30", status: "sent" });
    const signals = detectDangerSignals(baseInput({ invoices: [inv] }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.overdueInvoice);
    expect(sig).toBeDefined();
    expect(sig?.detail).toMatch(/延滞/);
  });

  it("paid の請求書は対象外", () => {
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-01-01", status: "paid" });
    const signals = detectDangerSignals(baseInput({ invoices: [inv] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.overdueInvoice)).toBeUndefined();
  });

  it("cancelled の請求書は対象外", () => {
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-01-01", status: "cancelled" });
    const signals = detectDangerSignals(baseInput({ invoices: [inv] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.overdueInvoice)).toBeUndefined();
  });
});

// ── lowMargin ──────────────────────────────────────────────────────────────

describe("detectDangerSignals — lowMargin", () => {
  it("粗利率 10% → シグナルなし (境界値)", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 10_000_000, grossProfit: 1_000_000 }),
    );
    expect(signals.find((s) => s.kind === DangerSignalKind.lowMargin)).toBeUndefined();
  });

  it("粗利率 9.9% → lowMargin シグナルあり", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 10_000_000, grossProfit: 990_000 }),
    );
    const sig = signals.find((s) => s.kind === DangerSignalKind.lowMargin);
    expect(sig).toBeDefined();
    expect(sig?.detail).toMatch(/粗利率/);
  });

  it("contractAmount が 0 → シグナルなし", () => {
    const signals = detectDangerSignals(
      baseInput({ contractAmount: 0, grossProfit: 0 }),
    );
    expect(signals.find((s) => s.kind === DangerSignalKind.lowMargin)).toBeUndefined();
  });
});

// ── stalledChat ────────────────────────────────────────────────────────────

describe("detectDangerSignals — stalledChat", () => {
  it("直近7日以内のチャットあり → シグナルなし", () => {
    const msg = makeChat({ id: "m1", timestamp: "2025-05-28T10:00:00Z" });
    const signals = detectDangerSignals(baseInput({ chatMessages: [msg] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.stalledChat)).toBeUndefined();
  });

  it("8日以上前のチャットのみ → stalledChat シグナルあり", () => {
    const msg = makeChat({ id: "m1", timestamp: "2025-05-20T10:00:00Z" });
    const signals = detectDangerSignals(baseInput({ chatMessages: [msg] }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.stalledChat);
    expect(sig).toBeDefined();
  });

  it("チャット履歴なし (active) → stalledChat シグナルあり", () => {
    const signals = detectDangerSignals(baseInput({ chatMessages: [] }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.stalledChat);
    expect(sig).toBeDefined();
    expect(sig?.detail).toMatch(/チャット履歴なし/);
  });

  it("チャット履歴なし (completed) → シグナルなし", () => {
    const project = makeProject({ status: "completed" });
    const signals = detectDangerSignals(baseInput({ project, chatMessages: [] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.stalledChat)).toBeUndefined();
  });
});

// ── photoMissing7Days ──────────────────────────────────────────────────────

describe("detectDangerSignals — photoMissing7Days", () => {
  it("7日以内に写真あり → シグナルなし", () => {
    const photo = makePhoto({ id: "p1", createdAt: "2025-05-28T10:00:00Z" });
    const signals = detectDangerSignals(baseInput({ photos: [photo] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.photoMissing7Days)).toBeUndefined();
  });

  it("写真ゼロ (active) → photoMissing7Days シグナルあり", () => {
    const signals = detectDangerSignals(baseInput({ photos: [] }));
    const sig = signals.find((s) => s.kind === DangerSignalKind.photoMissing7Days);
    expect(sig).toBeDefined();
  });

  it("写真ゼロ (completed) → シグナルなし", () => {
    const project = makeProject({ status: "completed" });
    const signals = detectDangerSignals(baseInput({ project, photos: [] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.photoMissing7Days)).toBeUndefined();
  });

  it("8日以上前の写真のみ → photoMissing7Days シグナルあり", () => {
    const photo = makePhoto({ id: "p1", createdAt: "2025-05-20T10:00:00Z" });
    const signals = detectDangerSignals(baseInput({ photos: [photo] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.photoMissing7Days)).toBeDefined();
  });

  it("takenAt フィールドを優先して判定", () => {
    // createdAt は8日前だが takenAt は3日前
    const photo = makePhoto({
      id: "p1",
      createdAt: "2025-05-20T10:00:00Z",
      takenAt: "2025-05-29T10:00:00Z",
    });
    const signals = detectDangerSignals(baseInput({ photos: [photo] }));
    expect(signals.find((s) => s.kind === DangerSignalKind.photoMissing7Days)).toBeUndefined();
  });
});

// ── 複合シナリオ ───────────────────────────────────────────────────────────

describe("detectDangerSignals — 複合シナリオ", () => {
  it("1プロジェクトに3種類同時検出", () => {
    // delayedSchedule: タスク10日遅延
    // overdueInvoice: 請求書45日延滞
    // lowMargin: 粗利率5%
    const task = makeTask({ id: "t1", dueDate: "2025-05-22", status: "in_progress" });
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-04-17", status: "sent" });
    const signals = detectDangerSignals(
      baseInput({
        tasks: [task],
        invoices: [inv],
        contractAmount: 10_000_000,
        grossProfit: 500_000, // 5%
        chatMessages: [makeChat({ id: "m1", timestamp: "2025-05-30T10:00:00Z" })], // チャットは最近
        photos: [makePhoto({ id: "p1", createdAt: "2025-05-30T10:00:00Z" })], // 写真も最近
      }),
    );
    const kinds = signals.map((s) => s.kind);
    expect(kinds).toContain(DangerSignalKind.delayedSchedule);
    expect(kinds).toContain(DangerSignalKind.overdueInvoice);
    expect(kinds).toContain(DangerSignalKind.lowMargin);
    expect(signals.length).toBe(3);
  });

  it("シグナルなし → 空配列を返す", () => {
    const msg = makeChat({ id: "m1", timestamp: "2025-05-31T10:00:00Z" });
    const photo = makePhoto({ id: "p1", createdAt: "2025-05-31T10:00:00Z" });
    const signals = detectDangerSignals(
      baseInput({
        contractAmount: 10_000_000,
        eac: 9_000_000,
        grossProfit: 2_000_000,
        chatMessages: [msg],
        photos: [photo],
      }),
    );
    expect(signals).toHaveLength(0);
  });

  it("全6種類同時検出", () => {
    const task = makeTask({ id: "t1", dueDate: "2025-05-01", status: "in_progress" }); // 31日遅延
    const inv = makeInvoice({ id: "inv1", dueDate: "2025-04-01", status: "sent" }); // 61日延滞
    const oldChat = makeChat({ id: "m1", timestamp: "2025-05-01T10:00:00Z" }); // 31日前
    const signals = detectDangerSignals(
      baseInput({
        tasks: [task],
        invoices: [inv],
        contractAmount: 10_000_000,
        eac: 11_000_000, // 10% 超過
        grossProfit: 500_000, // 5%
        chatMessages: [oldChat],
        photos: [], // 写真なし
      }),
    );
    expect(signals.length).toBe(6);
    const kinds = signals.map((s) => s.kind);
    expect(kinds).toContain(DangerSignalKind.delayedSchedule);
    expect(kinds).toContain(DangerSignalKind.budgetOverrun);
    expect(kinds).toContain(DangerSignalKind.overdueInvoice);
    expect(kinds).toContain(DangerSignalKind.lowMargin);
    expect(kinds).toContain(DangerSignalKind.stalledChat);
    expect(kinds).toContain(DangerSignalKind.photoMissing7Days);
  });
});
