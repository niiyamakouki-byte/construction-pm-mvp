# cost-loss-detector

受発注データ・労務記録から原価ロスを早期検知するピュアロジックエンジン。
外部 API 課金なし。localStorage 永続化。

---

## アーキテクチャ

```
OrderRecord / LaborRecord
        │
        ▼
detector-rules.ts   ← 6 ルール関数（純関数）
        │
        ▼
loss-aggregator.ts  ← runAllDetectors + aggregateLoss
        │
        ▼
loss-store.ts       ← LossStore (EventTarget + localStorage)
        │
        ▼
CostLossDashboardPage.tsx  ← UI
```

---

## 検知ルール一覧

| # | LossKind | 説明 | 閾値 |
|---|----------|------|------|
| 1 | `material_surplus` | 材料余剰 | qty/plannedQty > 1.1 → warning, > 1.3 → critical |
| 2 | `material_shortage_emergency` | 緊急再発注 | 同 itemCode/projectId を 30 日以内に 2 回以上発注 |
| 3 | `labor_overrun` | 工数超過 | actual/planned > 1.2 → warning, > 1.5 → critical |
| 4 | `out_of_scope_order` | 見積外発注 | extra 合計が in_scope の 5% 超 → warning |
| 5 | `price_creep` | 見積単価超過 | unit / plannedUnit > 1.05 → warning, > 1.2 → critical |
| 6 | `wastage_high` | 歩留り悪化 | usedQty/qty < 0.85 (最低 3 件) → warning, < 0.70 → critical |

---

## lossYen 計算式

| ルール | 計算式 |
|--------|--------|
| material_surplus | `(qty - plannedQty) × unitPriceYen` |
| material_shortage_emergency | `Σ(extraOrders.qty × unitPriceYen) × 0.10` (緊急調達プレミアム 10% 推定) |
| labor_overrun | `(hoursActual - hoursPlanned) × ¥3,500/h` |
| out_of_scope_order | `Σ(extra.qty × unitPriceYen)` |
| price_creep | `(unitPriceYen - plannedUnitPriceYen) × qty` |
| wastage_high | `(totalOrdered - totalUsed) × avgUnitPrice` |

---

## 使用例

```typescript
import { runAllDetectors, aggregateLoss } from "./loss-aggregator.js";
import { getLossStore } from "./loss-store.js";

// 1. 検知
const signals = runAllDetectors(orders, laborRecords);

// 2. 集計
const summary = aggregateLoss(signals.filter(s => s.projectId === "p1"));
console.log(`推定ロス: ¥${summary.totalLossYen.toLocaleString("ja-JP")}`);

// 3. 永続化
const store = getLossStore();
store.recordSignals(signals);

// 4. 取得
const p1Signals = store.signalsForProject("p1");

// 5. 対応済
store.markResolved(signalId);
```

---

## LossStore

- `localStorage` キー: `genbahub:loss-signals`
- 上限: 5,000 件 (FIFO 蒸発)
- `EventTarget` で `'change'` イベントを発火 → React `useEffect` で購読可能

---

## サンプル LossSummary (1案件・3シグナル)

```json
{
  "projectId": "proj-001",
  "totalLossYen": 185000,
  "generatedAt": "2025-06-01T10:00:00.000Z",
  "byKind": {
    "material_surplus": 100000,
    "material_shortage_emergency": 0,
    "labor_overrun": 52500,
    "out_of_scope_order": 0,
    "price_creep": 32500,
    "wastage_high": 0
  },
  "signals": [
    {
      "id": "loss-1001-1",
      "projectId": "proj-001",
      "kind": "material_surplus",
      "severity": "critical",
      "detectedAt": "2025-06-01T10:00:00.000Z",
      "evidenceRefs": ["order-045"],
      "lossYen": 100000,
      "message": "品目 TILE-300x300: 発注数 650枚 が計画数 500枚 を 30% 超過",
      "suggestedAction": "余剰分を次工事に流用するか、仕入先に返品交渉してください"
    },
    {
      "id": "loss-1001-2",
      "projectId": "proj-001",
      "kind": "labor_overrun",
      "severity": "warning",
      "detectedAt": "2025-06-01T10:00:00.000Z",
      "evidenceRefs": ["labor-082"],
      "lossYen": 52500,
      "message": "タスク tiling-floor: 実績 25h が計画 10h を 150% 超過 (超過 15.0h)",
      "suggestedAction": "工程見直しと作業員の技能訓練を検討してください"
    },
    {
      "id": "loss-1001-3",
      "projectId": "proj-001",
      "kind": "price_creep",
      "severity": "warning",
      "detectedAt": "2025-06-01T10:00:00.000Z",
      "evidenceRefs": ["order-051"],
      "lossYen": 32500,
      "message": "品目 WOOD-OAK-90: 発注単価 ¥6,500 が見積単価 ¥6,000 を 8% 超過",
      "suggestedAction": "仕入先と単価交渉するか、代替品を検討してください"
    }
  ]
}
```

---

## ML 展望

現在のルールベース検知から機械学習への発展経路:

1. **異常検知モデル**: 過去の OrderRecord/LaborRecord から正常分布を学習し、外れ値を確率スコア付きで検知
2. **時系列予測**: プロジェクト途中時点のデータから最終原価オーバーランを予測 (EAC)
3. **クラスタリング**: 類似案件パターンのグルーピング → 業種別・規模別のベンチマーク自動生成
4. **自然言語処理**: 発注書 OCR テキストから品目コード・単価を自動抽出して OrderRecord を生成

現時点では `lossYen` の計算式・閾値が教師データの役割を担う。ML 導入時は `LossSignal.severity` をラベルとして活用可能。
