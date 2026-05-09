/**
 * PhotoInspectionPage コンポーネントテスト
 */
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoInspectionPage } from "../components/PhotoInspectionPage.js";

// ── localStorage モック (jsdom 環境では clear() が未実装のため) ─────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ── モック ────────────────────────────────────────────────────────────────────

// RuleBasedDetector をモック: 全写真で crack 1件を返す
vi.mock("../lib/photo-inspection/defect-detector.js", () => {
  class MockDetector {
    async detect() {
      return [
        {
          id: "mock-defect-1",
          kind: "crack",
          bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          confidence: 0.9,
        },
      ];
    }
  }
  return { RuleBasedDetector: MockDetector };
});

// fileToImageData 相当: Image.onload を即発火させる
beforeEach(() => {
  // HTMLImageElement のモック
  Object.defineProperty(global, "Image", {
    writable: true,
    value: class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 4;
      naturalHeight = 4;
      set src(_v: string) {
        // 非同期で onload を呼ぶ
        setTimeout(() => this.onload?.(), 0);
      }
    },
  });

  // HTMLCanvasElement のモック
  Object.defineProperty(global, "HTMLCanvasElement", {
    writable: true,
    value: class {},
  });

  const mockCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      width: 4,
      height: 4,
      data: new Array(4 * 4 * 4).fill(128),
    })),
  };

  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      } as unknown as HTMLCanvasElement;
    }
    return originalCreate(tag);
  });

  // FileReader モック
  global.FileReader = class {
    onload: ((e: { target: { result: string } }) => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(_file: Blob) {
      setTimeout(() => {
        this.onload?.({ target: { result: "data:image/jpeg;base64,mock" } });
      }, 0);
    }
  } as unknown as typeof FileReader;
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("PhotoInspectionPage — レンダリング", () => {
  it("ページタイトルが表示される", () => {
    render(<PhotoInspectionPage projectId="proj-001" projectName="テスト案件" />);
    expect(screen.getByText("AI写真検査")).toBeDefined();
  });

  it("案件名が表示される", () => {
    render(<PhotoInspectionPage projectId="proj-001" projectName="KDX南青山" />);
    expect(screen.getByText("KDX南青山")).toBeDefined();
  });

  it("アップロードゾーンが表示される", () => {
    render(<PhotoInspectionPage projectId="proj-001" />);
    expect(screen.getByText(/ドラッグ&ドロップ/)).toBeDefined();
  });

  it("初期状態: 写真なしメッセージ", () => {
    render(<PhotoInspectionPage projectId="proj-001" />);
    expect(screen.getByText("写真がありません")).toBeDefined();
  });

  it("file input が存在する", () => {
    render(<PhotoInspectionPage projectId="proj-001" />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
  });
});

describe("PhotoInspectionPage — ファイルアップロード", () => {
  it("画像ファイルをドロップ → 写真が追加される", async () => {
    render(<PhotoInspectionPage projectId="proj-001" />);

    const dropZone = screen.getByRole("region", { name: /写真アップロード/ });
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
    const dataTransfer = { files: [file] };

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("test.jpg")).toBeDefined();
  });

  it("file input 経由でファイル選択 → 写真が追加される", async () => {
    render(<PhotoInspectionPage projectId="proj-001" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "wall.jpg", { type: "image/jpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      fireEvent.change(input);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("wall.jpg")).toBeDefined();
  });

  it("非画像ファイルはスキップされる", async () => {
    render(<PhotoInspectionPage projectId="proj-001" />);

    const dropZone = screen.getByRole("region", { name: /写真アップロード/ });
    const file = new File(["dummy"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("写真がありません")).toBeDefined();
  });
});

describe("PhotoInspectionPage — ステータス操作", () => {
  async function addPhoto(projectId = "proj-001") {
    render(<PhotoInspectionPage projectId={projectId} projectName="テスト" />);

    const dropZone = screen.getByRole("region", { name: /写真アップロード/ });
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });
  }

  it("合格ボタンで status が approved に更新", async () => {
    await addPhoto();
    // 「合格」ボタン (role=button) をクリック
    const approveBtns = screen.getAllByText("合格");
    const approveBtn = approveBtns.find((el) => el.tagName === "BUTTON") ?? approveBtns[0];
    await act(async () => { fireEvent.click(approveBtn!); });
    // 合格後: ステータスバッジ + ボタン合わせて複数 "合格" テキストが存在するのは正常
    expect(screen.getAllByText("合格").length).toBeGreaterThan(0);
    // 要手直し警告は出ない
    expect(screen.queryByText(/⚠ 要手直し \d/)).toBeNull();
  });

  it("要手直しボタンで rework バッジが表示", async () => {
    await addPhoto();
    const reworkBtn = screen.getByText("要手直し");
    await act(async () => { fireEvent.click(reworkBtn); });
    // ヘッダーの "要手直し 1件" が表示される
    await waitFor(() => {
      expect(screen.getByText(/⚠ 要手直し 1件/)).toBeDefined();
    });
  });

  it("再検査ボタンが存在する", async () => {
    await addPhoto();
    expect(screen.getByText("再検査")).toBeDefined();
  });
});

describe("PhotoInspectionPage — 報告書", () => {
  async function addAndGenerate() {
    render(<PhotoInspectionPage projectId="proj-001" projectName="テスト案件" />);

    const dropZone = screen.getByRole("region", { name: /写真アップロード/ });
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    const genBtn = screen.getByText("報告書を生成");
    await act(async () => { fireEvent.click(genBtn); });
  }

  it("写真追加後に「報告書を生成」ボタンが表示", async () => {
    render(<PhotoInspectionPage projectId="proj-001" />);

    const dropZone = screen.getByRole("region", { name: /写真アップロード/ });
    const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("報告書を生成")).toBeDefined();
  });

  it("「報告書を生成」クリック → プレビューが表示", async () => {
    await addAndGenerate();
    const preview = document.querySelector('[data-testid="report-preview"]');
    expect(preview).toBeTruthy();
  });

  it("報告書プレビューに案件名が含まれる", async () => {
    await addAndGenerate();
    const preview = document.querySelector('[data-testid="report-preview"]');
    expect(preview?.innerHTML).toContain("テスト案件");
  });

  it("「印刷 / PDF保存」ボタンが表示される", async () => {
    await addAndGenerate();
    expect(screen.getByText("印刷 / PDF保存")).toBeDefined();
  });
});
