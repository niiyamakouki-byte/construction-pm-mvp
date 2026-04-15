# PDF→見積ドラフト 自動化フロー

## 全体像

```
[CAD PDF] → [pdf-vector-extractor] → [内装セマンティック層] → [数量拾い] → [cost-master照合] → [見積ドラフト] → [EstimatePage]
```

## ステージ別詳細

### Stage 1: PDF抽出
- `pdf-vector-extractor`（Python）で `DrawingModel` を生成
- 線・矩形・テキスト・レイヤー・縮尺を JSON 出力
- 出力: `DrawingModel` JSON（`src/lib/pdf-to-estimate/types.ts` と対応）

### Stage 2: 内装セマンティック層
- 入力: `DrawingModel` JSON
- 出力: `InteriorElement[]`
  - 壁線セグメント（長さ m）
  - 開口（建具/窓、幅×高さ mm）
  - 部屋領域（多角形、面積 ㎡）
  - 床材境界（面積 ㎡）
- 実装: `src/lib/pdf-to-estimate/interior-semantic.ts`

### Stage 3: 数量拾い
- 入力: `InteriorElement[]`
- 出力: `QuantityTakeoff`
  - 内装面積: 壁 ㎡ / 床 ㎡ / 天井 ㎡
  - 建具個数: 種別×数量
  - 部材長: 巾木 m / 廻り縁 m / LGS m
- 実装: `src/lib/pdf-to-estimate/quantity-takeoff-from-pdf.ts`
- 既存 `src/lib/drawing-takeoff.ts` の Shoelace 面積ロジックを踏襲

### Stage 4: cost-master照合
- 入力: `QuantityTakeoff` + `vw-plugin/src/resources/cost-master.json`
- 突合: `interior` カテゴリを優先、アセンブリテンプレートで複合工事を組み立て
  - 壁: LGS(IN-001) + PB(IN-003) + クロス(IN-005) 標準構成
  - 床: フロアタイル(IN-011) or タイルカーペット(IN-008)
  - 天井: 軽鉄下地(IN-068) + 石膏ボード天井(IN-015)
  - 建具: 木製建具(FX-001) + 取付工
- 出力: `EstimateDraft`（各行に信頼度スコア付き）
- 実装: `src/lib/pdf-to-estimate/estimate-composer.ts`

### Stage 5: ドラフト出力
- `EstimatePage` に「PDF由来ドラフト」として表示
- 各行に信頼度スコア（抽出精度由来、0.0〜1.0）を表示
- 光輝さんが確認→承認で正式見積に昇格

## TypeScript型定義

```typescript
// src/lib/pdf-to-estimate/types.ts

interface InteriorElement {
  kind: "wall" | "opening" | "room" | "floor_area";
  geometry: WallGeometry | OpeningGeometry | RoomGeometry | FloorAreaGeometry;
  inferredFrom: { pdfPage: number; confidence: number };
}

interface QuantityTakeoff {
  items: Array<{
    category: string;
    item: string;
    quantity: number;
    unit: "m" | "m2" | "個";
    source: "pdf" | "manual" | "ai_estimate";
    confidence: number;
  }>;
}

interface EstimateDraft {
  sourcePdfPath: string;
  drawingModel: DrawingModel;
  takeoff: QuantityTakeoff;
  lines: EstimateLine[];
  totalExcludingTax: number;
  notes: string[];
  confidence: number;
}
```

## 既知の限界
- 曲線は拾えない（扉スイング等）
- レイヤー情報が無い PDF は推測精度落ちる（confidence 低下）
- 内装以外（構造体・設備）の抽出は次 Phase
- PDF の縮尺情報がない場合、`scale_mm_per_pt` が null となり mm 換算不能（エラー扱い）
- 斜め壁（非直交）は面積計算に誤差が出る可能性あり

## 参照ファイル
- `src/lib/pdf-to-estimate/types.ts` — 全型定義
- `src/lib/pdf-to-estimate/interior-semantic.ts` — Stage 2 実装
- `src/lib/pdf-to-estimate/quantity-takeoff-from-pdf.ts` — Stage 3 実装
- `src/lib/pdf-to-estimate/estimate-composer.ts` — Stage 4 実装
- `vw-plugin/src/resources/cost-master.json` — 単価マスタ（250品目）
