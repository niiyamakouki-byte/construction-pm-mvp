import { useEffect, useRef } from "react";
import samplePdfUrl from "../pages/EstimatePage/__tests__/fixtures/floorplan-single-1-100.pdf?url";
import { PdfCanvasPreview } from "./PdfCanvasPreview.js";

// ponytail: 認証もSupabaseデータも要らない。既存のテスト用PDF fixtureをそのまま
// Viteの?url importでブラウザ配信し、本番と同じpdf.js描画パスを素で通す。
export const Default = () => (
  <div style={{ maxWidth: 480 }}>
    <PdfCanvasPreview src={samplePdfUrl} title="床伏図サンプル" documentId="ladle-preview-pdf-canvas" />
  </div>
);

// ペン種ボタン行(ボールペン/蛍光ペン/太マーカー/鉛筆)は「赤入れ」トグルの内部stateで
// 出し分けており、propsで直接は開けない。実DOMをクリックして開いた状態を初期表示にする
// (Playwrightと同じやり方。annotateActiveをpropに昇格するほどの変更ではない)。
export const AnnotateToolbar = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // PDF読み込み(非同期)が終わって「赤入れ」ボタンがDOMに現れるまで待ってからクリックする。
    const timer = window.setInterval(() => {
      const button = Array.from(containerRef.current?.querySelectorAll("button") ?? []).find((b) =>
        b.textContent?.includes("赤入れ"),
      );
      if (button) {
        button.click();
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div ref={containerRef} style={{ maxWidth: 480 }}>
      <PdfCanvasPreview src={samplePdfUrl} title="床伏図サンプル" documentId="ladle-preview-pen-toolbar" />
    </div>
  );
};
