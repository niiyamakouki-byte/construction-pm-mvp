# photo-inspection — AI写真検査モジュール

現場写真をアップロードし、傷・汚れ・施工不良を自動検知して報告書を生成するモジュール。

## モジュール構成

```
src/lib/photo-inspection/
├── types.ts              — 共通型定義 (DefectKind, Defect, InspectionPhoto, InspectionReport)
├── defect-detector.ts    — IDetector インターフェース + RuleBasedDetector
├── inspection-store.ts   — InspectionStore (EventTarget + localStorage)
├── report-generator.ts   — generateReport() 報告書生成
└── report-pdf-renderer.ts — renderReportHTML() HTML/CSS レポートレンダラー
```

## 欠陥種別 (DefectKind)

| kind          | 日本語      | 重み |
|---------------|-------------|------|
| crack         | ひび割れ    | 3    |
| water_damage  | 水濡れ・雨漏り | 3 |
| missing_part  | 部品欠損    | 2    |
| misalignment  | 施工ズレ    | 2    |
| peeling       | 剥がれ      | 2    |
| scratch       | 傷          | 1    |
| stain         | 汚れ        | 1    |
| discoloration | 変色        | 1    |

重み ≥ 2 の欠陥を「高リスク (highSeverityCount)」としてカウントする。

## IDetector インターフェース

将来の ML モデル差し替えに備えた抽象化:

```ts
interface IDetector {
  detect(imageData: ImageDataLike): Promise<Defect[]>;
}
```

- **現在**: `RuleBasedDetector` — Sobel エッジ + カラーヒストグラム + 局所コントラストによるルールベース
- **将来**: ONNX YOLO モデルを `detect()` に差し込むだけで置き換え可能

> ⚠ 注意: 現状 `RuleBasedDetector` は誤検知率が高い。
> 将来的に ONNX YOLO モデルへの差し替えを予定している。
> 現在はデモ・テスト用途として使用すること。

## ブラウザ使用例

```ts
import { RuleBasedDetector } from "./defect-detector";
import { InspectionStore } from "./inspection-store";
import { generateReport } from "./report-generator";
import { renderReportHTML } from "./report-pdf-renderer";

const detector = new RuleBasedDetector();
const store = new InspectionStore();

// ファイルから ImageData を取得
const bitmap = await createImageBitmap(file);
const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
const ctx = canvas.getContext("2d")!;
ctx.drawImage(bitmap, 0, 0);
const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

// 検出
const defects = await detector.detect(imageData);

// 保存
const photo = store.add({
  projectId: "proj-001",
  capturedAt: new Date().toISOString(),
  imageUrl: URL.createObjectURL(file),
  fileName: file.name,
  defects,
  status: "inspected",
});

// 報告書生成
const report = generateReport("proj-001", store.queryByProject("proj-001"), "我妻");
const html = renderReportHTML(report, "KDX南青山");

// 印刷
const win = window.open();
win?.document.write(html);
win?.print();
```

## テスト

```bash
pnpm test -- --run src/__tests__/photo-inspection
```

Node 環境では OffscreenCanvas が使えないため、テストは `ImageDataLike` フィクスチャ (RGBA 配列) を直接 `detector.detect()` に渡してロジックを検証する。
