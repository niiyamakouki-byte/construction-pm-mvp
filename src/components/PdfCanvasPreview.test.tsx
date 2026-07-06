/**
 * PdfCanvasPreview の回帰テスト。
 *
 * construction_pm_mvp-6jt: 直接.pdf URLをブラウザネイティブPDFビューアの
 * <iframe src={url}> にそのまま埋め込む実装は黒画面になる不具合があった。
 * 修正後は pdf.js で自前に<canvas>へ描画するため、
 * (1) 生のPDFバイト列を指すiframeを二度と使わないこと
 * (2) 読み込み成功時にcanvasへの描画(render)が実際に呼ばれること
 * (3) 読み込み失敗時は黒い箱ではなくエラーメッセージにフォールバックすること
 * を機械的に検証する。
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRenderTaskPromise = vi.fn();
const mockRender = vi.fn();
const mockGetPage = vi.fn();
let mockGetDocumentImpl: (() => { promise: Promise<unknown>; destroy: () => void }) | null = null;

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: {} as { workerSrc?: string },
  getDocument: (...args: unknown[]) => mockGetDocumentImpl!(...(args as [])),
}));

vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", () => ({
  default: "mock-worker-src",
}));

import { PdfCanvasPreview } from "./PdfCanvasPreview.js";

function makeFakePage() {
  return {
    getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 140 * scale }),
    render: (...args: unknown[]) => {
      mockRender(...args);
      return { promise: mockRenderTaskPromise(), cancel: vi.fn() };
    },
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({}) as unknown as CanvasRenderingContext2D,
  );
  mockRenderTaskPromise.mockReset().mockResolvedValue(undefined);
  mockRender.mockReset();
  mockGetPage.mockReset().mockResolvedValue(makeFakePage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PdfCanvasPreview", () => {
  it("読み込み成功時、生PDFのiframeではなくcanvasへ実際に描画する", async () => {
    mockGetDocumentImpl = () => ({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: vi.fn(),
    });

    const { container } = render(
      <PdfCanvasPreview src="https://example.com/sample.pdf" title="サンプル資料" />,
    );

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    // 黒画面バグの根本原因だった「生PDF URLへのiframe」が存在しないこと
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("読み込みに失敗した場合、黒い箱ではなくエラーメッセージを表示する", async () => {
    mockGetDocumentImpl = () => ({
      promise: Promise.reject(new Error("network error")),
      destroy: vi.fn(),
    });

    render(<PdfCanvasPreview src="https://example.com/broken.pdf" title="壊れた資料" />);

    await screen.findByText(/読み込めませんでした/);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("ズームボタンで拡大率が変わり、都度canvasへ再描画される", async () => {
    mockGetDocumentImpl = () => ({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: vi.fn(),
    });

    render(<PdfCanvasPreview src="https://example.com/sample.pdf" title="サンプル資料" />);

    await waitFor(() => expect(mockRender).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByRole("button", { name: "拡大" }).click();
    });

    await waitFor(() => expect(mockRender).toHaveBeenCalledTimes(2));
    expect(screen.getByText("125%")).toBeTruthy();
  });
});
