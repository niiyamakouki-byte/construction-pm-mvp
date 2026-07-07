import { PdfAnnotationLayer } from "./PdfAnnotationLayer.js";

const WIDTH = 480;
const HEIGHT = 640;

// ponytail: PdfCanvasPreviewに埋め込まず単体で表示。背景はPDFページの代わりに
// プレースホルダーの矩形。マウスでドラッグするとストロークが描ける(active=true固定)。
export const Default = () => (
  <div
    style={{
      position: "relative",
      width: WIDTH,
      height: HEIGHT,
      background: "#F7F6F3",
      border: "1px solid #EAEAEA",
    }}
  >
    <PdfAnnotationLayer
      documentId="ladle-preview-annotation-layer"
      pageNumber={1}
      viewportWidth={WIDTH}
      viewportHeight={HEIGHT}
      active
      tool="pen"
      color="#346538"
      strokeWidthPx={5}
      penKind="ballpoint"
    />
  </div>
);
