# 現場AIチャットアシスタント (site-ai-assistant)

Sprint 12-A 実装。職人/監督が日報やチャットで困りごとを書くと、過去事例DBから解決策候補を3件提示する。

## 設計概要

### モジュール構成

```
src/lib/site-ai-assistant/
├── types.ts              # 型定義 (IssueCategory, Issue, Solution, PastCase, AssistantResponse)
├── issue-classifier.ts   # 純Regex分類器
├── case-store.ts         # 過去事例ストア (EventTarget + localStorage)
├── rule-based-fallback.ts # 8カテゴリ × 3手順の固定ガイド
└── solution-engine.ts    # ソリューション生成エンジン
```

### データフロー

```
Issue (text) 
  → classifyIssue()        : Regex → IssueCategory
  → findByCategory()       : カテゴリ一致ケースを収集
  → searchByKeywords()     : キーワードスコアリング
  → スコア合算 + top3     : past_case Solution × 3
  → ヒット0件の場合        : rule_based fallback Solution × 1
  → AssistantResponse
```

### 制約事項

- **外部API/LLM 完全不使用**: 純Regex + localStorage + 静的ルール
- **オフライン動作**: インターネット接続不要
- **API課金ゼロ**: 全処理がブラウザ内で完結

### 過去事例ストア

- localStorage キー: `genbahub:past-cases`
- 上限: 1000件 (超過時は FIFO で古い順に削除)
- シードデータ: 20件 (全8カテゴリ、各2-3件)
- `EventTarget` 継承でストア変更をリアクティブに購読可能

### 分類キーワード辞書

| カテゴリ | 代表キーワード |
|---|---|
| material_shortage | 足りない, 欠品, 在庫, 不足 |
| weather_delay | 雨, 雪, 台風, 天候 |
| tool_breakdown | 壊れた, 故障, 使えない |
| coordination | 連絡, 調整, 伝わってない, 指示 |
| safety_concern | 危険, ヒヤリ, 事故, ケガ |
| quality_issue | 不具合, やり直し, 汚れ, 傷 |
| client_request | 施主, お客様, 要望, 変更 |
| other | (マッチなし) |

### confidence スコア計算

```
normalizedScore     = score / maxScore            (0–1)
normalizedSat       = (satisfaction - 1) / 4      (0–1)
raw                 = normalizedScore * 0.7 + normalizedSat * 0.3
confidence          = clamp(raw, 0.3, 0.95)
```

## 将来の LLM 接続展望

現在は純ロジック実装だが、以下の拡張が容易にできる設計になっている。

### ローカル AI 接続 (外部課金なし)

`solution-engine.ts` の `suggestSolutions()` は現在同期処理だが、非同期版に置き換えることで以下が可能:

```typescript
// 将来のローカルLLM接続例 (ブラウザ内WebLLM/Transformers.js)
async function enhanceSolutionWithLocalLLM(issue: Issue, solutions: Solution[]): Promise<Solution[]> {
  // WebLLM / @xenova/transformers 等でブラウザ内推論
  // APIキー不要、課金ゼロ
}
```

**候補技術**:
- [WebLLM](https://github.com/mlc-ai/web-llm): WebGPU上でLLMをブラウザ内実行
- [Transformers.js](https://github.com/xenova/transformers.js): Hugging Face モデルをブラウザで動作

### 外部API接続 (要課金承認)

```typescript
// Anthropic Claude API 経由で自然言語解説を追加 (要課金承認)
// issue-classifier → LLM でカテゴリ精度向上
// solution-engine → RAG でより文脈に合ったステップ生成
```

**重要**: 外部 AI API の課金は別途承認が必要。現状はローカル処理に留める。

### GenbaHub 連携展望

- 採用した Solution を GenbaHub の「事例DB」として蓄積
- `PastCaseStore` の永続化層を Supabase に移行
- 複数プロジェクト横断でのナレッジ共有
