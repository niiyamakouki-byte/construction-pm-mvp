/**
 * TakeoffPage — ユニットテスト
 * 空状態 / 画像アップロード → DrawingViewer マウント / 見積流し込み
 * pdfjs は使わない（画像経路のみ）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TAKEOFF_INJECT_KEY } from "../lib/takeoff-to-estimate.js";

// ── localStorage mock ────────────────────────────────────────────────────────
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  clear: vi.fn(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  }),
};

// ── URL.createObjectURL / revokeObjectURL ────────────────────────────────────
const createdUrls: string[] = [];
const objectUrlSeq = { n: 0 };

// ── pdfjs を防衛モック（画像経路では呼ばれないがインポート時に副作用回避） ──
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

describe("TakeoffPage", () => {
  beforeEach(() => {
    cleanup();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    createdUrls.length = 0;
    objectUrlSeq.n = 0;
    vi.stubGlobal("localStorage", localStorageMock);
    // URL コンストラクタ自体は壊さず、createObjectURL/revokeObjectURL のみ差し替える
    URL.createObjectURL = vi.fn((_b: Blob) => {
      const url = `blob:test-${++objectUrlSeq.n}`;
      createdUrls.push(url);
      return url;
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    // hash ルーターを使うので location.hash を初期化
    window.location.hash = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("空状態でアップロード説明を表示する", async () => {
    const { TakeoffPage } = await import("./TakeoffPage.js");
    render(<TakeoffPage />);
    expect(screen.getByTestId("takeoff-dropzone")).toBeDefined();
    expect(screen.getByText(/ファイルを選択/)).toBeDefined();
    expect(screen.getByText("図面拾い出し")).toBeDefined();
  });

  it("画像ファイルをアップロードすると DrawingViewer がマウントされる", async () => {
    const { TakeoffPage } = await import("./TakeoffPage.js");
    render(<TakeoffPage />);

    const input = screen.getByTestId("takeoff-file-input") as HTMLInputElement;
    const file = new File(["fake-png-bytes"], "test-drawing.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    // DrawingViewer の代表的な要素「ピン/縮尺設定/拾い出し」ボタンが出る
    await waitFor(() => {
      expect(screen.getByText("拾い出し")).toBeDefined();
    });
    expect(screen.getByText("縮尺設定")).toBeDefined();
    expect(screen.getByAltText("図面")).toBeDefined();
    // object URL が作られている
    expect(createdUrls.length).toBeGreaterThan(0);
  });

  it("見積流し込みヘルパーが localStorage に書いて /estimate に遷移する", async () => {
    const { __sendSessionToEstimate } = await import("./TakeoffPage.js");
    // takeoff-session の最小限のセッション形を直接構築
    const { createSession, addSegment } = await import("../lib/takeoff-session.js");
    let session = createSession("drawing-1", "project-1");
    session = addSegment(session, {
      category: "壁",
      measureKind: "area",
      value: 12.5,
    });

    const ok = __sendSessionToEstimate(session);
    expect(ok).toBe(true);

    // localStorage に書かれた
    const raw = mockStorage[TAKEOFF_INJECT_KEY];
    expect(raw).toBeDefined();
    const items = JSON.parse(raw!) as Array<{ code: string; quantity: number }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.code).toMatch(/^TAKEOFF_壁_area$/);
    expect(items[0]!.quantity).toBeCloseTo(12.5, 2);

    // hash が /estimate に遷移
    expect(window.location.hash).toBe("#/estimate");
  });

  it("空セッションでは inject せず false を返す", async () => {
    const { __sendSessionToEstimate } = await import("./TakeoffPage.js");
    const { createSession } = await import("../lib/takeoff-session.js");
    const session = createSession("d", "p");

    const ok = __sendSessionToEstimate(session);
    expect(ok).toBe(false);
    expect(mockStorage[TAKEOFF_INJECT_KEY]).toBeUndefined();
  });
});
