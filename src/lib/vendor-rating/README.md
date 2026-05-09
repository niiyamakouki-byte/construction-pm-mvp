# Vendor Rating AI

協力会社の納期/品質/価格/コミュニケーションを履歴から定量化し、次回発注時に推奨スコアを返すモジュール。

## ファイル構成

```
src/lib/vendor-rating/
  types.ts                 — VendorEventKind, VendorEvent, VendorScore, VendorRecommendation
  score-calculator.ts      — calculateScore(events) → VendorScore
  event-store.ts           — VendorEventStore (localStorage, EventTarget, シングルトン)
  recommendation-engine.ts — recommendForCategory(category, vendors) → VendorRecommendation[]
```

## スコアリング設計

### 4軸とイベント種別

| 軸 | Positive | Negative |
|---|---|---|
| 納期 | `delivery_on_time` | `delivery_late` |
| 品質 | `quality_pass` | `quality_rework` |
| 価格 | `quote_competitive` | `quote_high` |
| 対応 | `comm_responsive` | `comm_slow` |

### スコア計算式

```
axis_score = positive_weight / (positive_weight + negative_weight) × 100
```

時間重み:
- 直近 30 日: `weight × 1.5`
- 31〜365 日: `weight × 1.0`
- 365 日超: `weight × 0.3`

総合スコア:
```
overall = delivery×0.3 + quality×0.35 + price×0.2 + comm×0.15
```

信頼度ペナルティ: `eventCount < 3` の場合 `overall × 0.7`

### 推奨シグナル

| スコア | シグナル |
|---|---|
| ≥ 70 | `recommended` |
| 40〜69 | `caution` |
| < 40 | `avoid` |

## データ収集ポイント

業者評価イベントは以下のタイミングで自動・手動登録する:

1. **発注完了時** — `quote_competitive` / `quote_high` (見積比較結果)
2. **工期完了時** — `delivery_on_time` / `delivery_late` (予定日 vs 実績日)
3. **完成検査時** — `quality_pass` / `quality_rework` (検査チェックリスト結果)
4. **連絡ログ** — `comm_responsive` / `comm_slow` (返信時間 SLA: 24h以内/超)

イベントには `weight` フィールドがあり、重要案件は `weight: 2.0` などで重みを調整できる。

## 永続化

`localStorage` キー: `genbahub:vendor-events`

- 最大 10,000 件保持 (超過時 FIFO 削除)
- 外部 API 不使用 (純ローカル処理)
- `VendorEventStore` は `EventTarget` を継承し、`change` イベントで UI を自動更新

## サンプル出力

```json
{
  "vendorId": "v-tanaka",
  "vendorName": "田中工務店",
  "overallScore": 78,
  "rank": 1,
  "signal": "recommended",
  "reasons": [
    "直近10件中8件納期遵守",
    "品質評価が高い",
    "競争力のある価格設定"
  ]
}
```

## 将来の機械学習化展望

現在のルールベーススコアリングは以下の ML 手法に置き換えられる:

1. **特徴量エンジニアリング** — イベント時系列をスライディングウィンドウ集計 (7d/30d/90d)
2. **発注成功率予測** — XGBoost/LightGBM でカテゴリ×業者×季節の組み合わせ学習
3. **異常検知** — Isolation Forest で急激なスコア低下を早期警告
4. **自然言語** — `notes` フィールドのセンチメント分析でスコアを補正
5. **協調フィルタリング** — 類似案件での他社評価を参考に未評価業者を推定

データは `localStorage` のまま収集し、クラウド移行時に Supabase テーブルに移植する。
