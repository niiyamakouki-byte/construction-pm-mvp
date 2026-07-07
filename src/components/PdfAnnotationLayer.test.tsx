/**
 * PdfAnnotationLayer の回帰テスト。
 *
 * ペン4種+ペン先プレビュー導入の際の品質監査(2026-07-07)で見つかった、
 * 描画中に別ポインタ(掌/2本目の指)のpointerdownが割り込むとストロークの
 * サンプル列が乗っ取られる不具合の再発防止テスト。あわせて、この
 * コンポーネントに対する直接テストがこれまで存在しなかった(PdfCanvasPreview
 * 経由の結合テストのみ)ギャップを埋める最小限のカバレッジも含む。
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfAnnotationLayer } from "./PdfAnnotationLayer.js";
import { loadAnnotations } from "../lib/pdf-annotations.js";

const DOC_ID = "pdf-annotation-layer-test-doc";

// jsdomのlocalStorageはこのプロジェクトのテスト環境では未設定のため、
// pdf-annotations.test.tsと同じくメモリ実装で差し替える。
function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function patchCanvasRect(canvas: HTMLCanvasElement, width: number, height: number) {
  const orig = canvas.getBoundingClientRect;
  canvas.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;
  return () => {
    canvas.getBoundingClientRect = orig;
  };
}

function pointerEvent(
  type: string,
  opts: { pointerId: number; clientX: number; clientY: number; pointerType?: string },
) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: opts.pointerId,
    clientX: opts.clientX,
    clientY: opts.clientY,
    pointerType: opts.pointerType ?? "touch",
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeMockStorage());
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PdfAnnotationLayer", () => {
  it("描画中に2本目のポインタ(掌/別指)が触れても1本目のストロークのサンプル列は乗っ取られない", () => {
    const { container } = render(
      <PdfAnnotationLayer
        documentId={DOC_ID}
        pageNumber={1}
        viewportWidth={300}
        viewportHeight={200}
        active
        tool="pen"
        color="#D64545"
        strokeWidthPx={2}
        penKind="ballpoint"
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    const restoreRect = patchCanvasRect(canvas!, 300, 200);

    act(() => {
      canvas!.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 30, clientY: 30 }));
      // 1本目が描画中のまま2本目(掌などの誤タップ)が触れる
      canvas!.dispatchEvent(pointerEvent("pointerdown", { pointerId: 2, clientX: 250, clientY: 150 }));
      canvas!.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 60, clientY: 60 }));
      canvas!.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, clientX: 60, clientY: 60 }));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const strokes = loadAnnotations(DOC_ID)[1] ?? [];
    expect(strokes).toHaveLength(1);
    // 乗っ取られていれば始点が2本目の(250,150)側にずれる
    expect(strokes[0]!.points[0]!.x).toBeCloseTo(30 / 300);
    expect(strokes[0]!.points[0]!.y).toBeCloseTo(30 / 200);

    restoreRect();
  });

  it("描画中に別ポインタのpointerupが1本目のストローク終了を誤って早期発火させない", () => {
    const { container } = render(
      <PdfAnnotationLayer
        documentId={DOC_ID}
        pageNumber={1}
        viewportWidth={300}
        viewportHeight={200}
        active
        tool="pen"
        color="#D64545"
        strokeWidthPx={2}
        penKind="ballpoint"
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    const restoreRect = patchCanvasRect(canvas!, 300, 200);

    act(() => {
      canvas!.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }));
      canvas!.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 40, clientY: 40 }));
      // 1本目が描画中のまま、2本目(掌など。pointerdown自体は既存ガードで無視される)の
      // pointerupだけが単独で届くケース(pointerId一致チェックが無いと1本目が誤って終了する)
      canvas!.dispatchEvent(pointerEvent("pointerup", { pointerId: 2, clientX: 250, clientY: 150 }));
      // 1本目はまだ描画継続中のはずなので、以降のmove/upで最後まで伸びる
      canvas!.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 80, clientY: 80 }));
      canvas!.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, clientX: 80, clientY: 80 }));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const strokes = loadAnnotations(DOC_ID)[1] ?? [];
    expect(strokes).toHaveLength(1);
    const last = strokes[0]!.points[strokes[0]!.points.length - 1]!;
    // 早期終了していれば終点は(40,40)止まりになる
    expect(last.x).toBeCloseTo(80 / 300);
    expect(last.y).toBeCloseTo(80 / 200);

    restoreRect();
  });

  it("getContextがテスト環境の最小限スタブ({}など)を返しても描画せずクラッシュしない", () => {
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => ({}) as unknown as CanvasRenderingContext2D);

    expect(() => {
      const { container } = render(
        <PdfAnnotationLayer
          documentId={DOC_ID}
          pageNumber={1}
          viewportWidth={300}
          viewportHeight={200}
          active
          tool="pen"
          color="#D64545"
          strokeWidthPx={2}
          penKind="ballpoint"
        />,
      );
      const canvas = container.querySelector("canvas");
      const restoreRect = patchCanvasRect(canvas!, 300, 200);
      act(() => {
        canvas!.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }));
        canvas!.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 20, clientY: 20 }));
        canvas!.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, clientX: 20, clientY: 20 }));
      });
      restoreRect();
    }).not.toThrow();

    getContextSpy.mockRestore();
  });

  it("ズームで viewport サイズが変わって再描画されても、確定済みストロークは保持される", () => {
    const { container, rerender } = render(
      <PdfAnnotationLayer
        documentId={DOC_ID}
        pageNumber={1}
        viewportWidth={300}
        viewportHeight={200}
        active
        tool="pen"
        color="#D64545"
        strokeWidthPx={2}
        penKind="ballpoint"
      />,
    );
    const canvas = container.querySelector("canvas");
    const restoreRect = patchCanvasRect(canvas!, 300, 200);

    act(() => {
      canvas!.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }));
      canvas!.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 40, clientY: 40 }));
      canvas!.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, clientX: 40, clientY: 40 }));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(loadAnnotations(DOC_ID)[1] ?? []).toHaveLength(1);

    // ピンチズーム相当のviewportサイズ変更(outlineキャッシュがクリアされる経路)
    expect(() => {
      rerender(
        <PdfAnnotationLayer
          documentId={DOC_ID}
          pageNumber={1}
          viewportWidth={450}
          viewportHeight={300}
          active
          tool="pen"
          color="#D64545"
          strokeWidthPx={2}
          penKind="ballpoint"
        />,
      );
    }).not.toThrow();

    expect(loadAnnotations(DOC_ID)[1] ?? []).toHaveLength(1);
    restoreRect();
  });
});
