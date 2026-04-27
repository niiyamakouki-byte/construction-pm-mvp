# GenbaHub i18n スコープ見積（実測ベース）

## 規模

- **JP含むファイル: 431ファイル** (src/**/*.{ts,tsx})
- **JP文字列リテラル: 2,348+ 箇所** (top 100ファイル抽出時点、実数はもっと多い)
- 内訳:
  - `pages/*.tsx` UIページ: ~50ファイル
  - `components/*.tsx`: ~30ファイル
  - `lib/*.ts` ロジック層: ~80ファイル
  - `__tests__/*` テスト: ~120ファイル（i18n対象外、テストはJP維持）
  - `api/routes/*` APIエラーメッセージ: ~30ファイル
  - `domain/*` zodスキーマ + バリデーションメッセージ: ~10ファイル
  - `infra/*` インフラ層: 微量
  - `estimate/*`, `mcp/*`: 業務ロジック

## 修正タイムライン（リアル）

| ステップ | 工数 |
|---|---|
| 1. i18nライブラリ選定 (`react-i18next` or `next-intl` 推奨) + セットアップ | 30分 |
| 2. UI層 (pages + components) 文字列抽出 → translation key置換 | **3-4時間** |
| 3. validation/error message 抽出 (zod, api/routes) | 1時間 |
| 4. EN自動翻訳 + 専門用語レビュー (建設業 60用語) | 1時間 |
| 5. 通貨表示 (¥ → ¥/$/€) フォーマッター実装 | 30分 |
| 6. 日付フォーマット (YYYY/MM/DD → ロケール依存) | 30分 |
| 7. 単位系 (㎡/坪/㎜ → m²/sqft/ft/in) 切替 | 1時間 |
| 8. 既存テスト 1,468件 の文字列assertion修正 | 1-2時間 |

**合計: 8-10時間** (executor 1本だと丸1日、2本並列で半日)

→ 当初「2-3時間」は楽観的すぎ。realistic estimate は **半日〜1日**。

## 並列分割案

executor分割で時間圧縮:
- **executor A**: i18nセットアップ + UI層 (pages + components)
- **executor B**: lib + api validation messages + zod schemas
- **executor C**: 通貨/日付/単位フォーマッター + ロケール設定
- **executor D**: テスト修正

→ 4本並列で **2-3時間** に圧縮可能

## 残課題（i18nだけでは終わらない世界化）

1. **freeeのglobal代替**: QuickBooks (US/CA), Xero (AU/NZ/UK), Zoho (SEA)
   - freee専用コードは `lib/freee-*.ts` 約8ファイル → 抽象化必要
2. **Stripe 多通貨対応**: 現状JPYのみ。USD/EUR/GBP対応必要
3. **建設業法依存**: 一人親方/インボイス制度 etc → リージョンflagで切替
4. **Supabase RLS**: 多言語テナント分離の検討

## 結論

GenbaHub のグローバル化は「i18n だけなら半日」だが、「実用レベル」までは **1週間集中**。

PDF Viewer (40分で済む) を先に出して反応を見るほうが早い。

PDF Viewer i18n → App Store 公開 → 反響観測 → GenbaHub global 投資判断、の順番推奨。
