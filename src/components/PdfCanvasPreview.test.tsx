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

// pdf.jsの実render()は同一canvasへ並行して呼ばれると
// "Cannot use the same canvas during multiple render() operations" を投げ、
// cancel()も非同期(呼び出し直後にcanvasが解放されるわけではない)。
// この2つの実際の挙動を再現できるフェイクにしておかないと、
// 並行render競合の回帰テストが意味を持たない。
let canvasBusy = false;

function makeFakePage({ rotate = 0 }: { rotate?: number } = {}) {
  return {
    rotate,
    getViewport: ({ scale, rotation = 0 }: { scale: number; rotation?: number }) => {
      // pdf.js実機は90/270度回転時にwidth/heightを入れ替える。
      const swapped = rotation % 180 !== 0;
      return {
        width: (swapped ? 140 : 100) * scale,
        height: (swapped ? 100 : 140) * scale,
      };
    },
    render: (...args: unknown[]) => {
      mockRender(...args);
      if (canvasBusy) {
        throw new Error("Cannot use the same canvas during multiple render() operations");
      }
      canvasBusy = true;
      let settled = false;
      let rejectFn!: (err: unknown) => void;
      // 実render taskを模したpromise。テストは明示的にcancel()するか、
      // タスクが「busyのまま(=描画中)」であることを利用する。
      const promise = new Promise<void>((_resolve, reject) => {
        rejectFn = reject;
      });
      return {
        promise,
        cancel: () => {
          if (settled) return;
          settled = true;
          // pdf.js実機のcancel()は同期的にcanvasを解放しない。
          // 解放とrejectがずれて起きることが並行render競合の原因になる。
          Promise.resolve().then(() => {
            canvasBusy = false;
            const err = new Error("Rendering cancelled");
            err.name = "RenderingCancelledException";
            rejectFn(err);
          });
        },
      };
    },
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({}) as unknown as CanvasRenderingContext2D,
  );
  canvasBusy = false;
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

  it("ページ自身の回転(/Rotate)を初期表示から反映し、横倒しにしない", async () => {
    // getViewportへrotationを明示的に渡すと、pdf.jsはページ自身の/Rotateを
    // 置き換えてしまう。ユーザーがまだ回転操作していない(rotation state = 0)の
    // 初期表示でも、page.rotateが90度のPDFはwidth/heightが入れ替わって
    // 表示されるべき(=横倒しにならない)。
    mockGetPage.mockReset().mockResolvedValue(makeFakePage({ rotate: 90 }));
    mockGetDocumentImpl = () => ({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: vi.fn(),
    });

    const { container } = render(
      <PdfCanvasPreview src="https://example.com/rotated.pdf" title="回転PDF" />,
    );

    await waitFor(() => expect(mockRender).toHaveBeenCalledTimes(1));

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.style.width).toBe("140px");
    expect(canvas.style.height).toBe("100px");
  });

  it("ピンチズーム中の高頻度なscale変更で並行renderが競合してもエラー画面にならない", async () => {
    // pdf.jsのcancel()は非同期(呼び出し直後にcanvasが解放されない)ため、
    // 前回のrenderTaskの完了を待たずに次のrender()を呼ぶと
    // 「同一canvasへの並行render」例外でビューア全体がエラー画面化する。
    // 1回目のgetPage()をこちらで制御し、getPage待ち中に2回目の
    // scale変更(=ピンチのtouchmove連打を想定)が割り込む状況を再現する。
    let resolveFirstGetPage!: (page: unknown) => void;
    const firstGetPagePromise = new Promise((resolve) => {
      resolveFirstGetPage = resolve;
    });
    const fakePage = makeFakePage();

    mockGetPage
      .mockReset()
      .mockImplementationOnce(() => firstGetPagePromise)
      .mockResolvedValue(fakePage);
    mockGetDocumentImpl = () => ({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: vi.fn(),
    });

    const { container } = render(
      <PdfCanvasPreview src="https://example.com/sample.pdf" title="サンプル資料" />,
    );

    // 1回目のrenderPage(generation 1)がgetPage待ちで一時停止している状態
    await waitFor(() => expect(mockGetPage).toHaveBeenCalledTimes(1));

    // ピンチのtouchmoveに相当するscale変更(generation 2)を割り込ませる
    await act(async () => {
      screen.getByRole("button", { name: "拡大" }).click();
    });

    // ここでgeneration 1のgetPageを解決する。
    // 修正前のコードだとcancel()直後に同一canvasへ即render()し、
    // 「Cannot use the same canvas」例外でstatus="error"に落ちる。
    resolveFirstGetPage(fakePage);

    await waitFor(() => expect(screen.getByText("125%")).toBeTruthy());

    expect(screen.queryByText(/読み込めませんでした/)).toBeNull();
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
