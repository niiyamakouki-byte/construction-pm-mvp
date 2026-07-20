# GenbaHub / LapoSite SaaS 公開前 機械検証 — 2026-07-21

- 来歴: 司令塔委譲「saasも公開まで頼む」(2026-07-21 00:44) / 実施ワーカー = Claude Opus 4.8
- 対象: https://construction-pm-mvp.vercel.app (別名 https://genbahub.vercel.app)
- 起点コミット: `a0fdc39` → 本タスクで `fa1b03b`, `ed8577a` を追加

## 判定: **公開不可 (NO-GO)**

`draft_2026_05_13_rls_phase1.sql` 自身が予告していたリスクが、本番で実測により成立した。

> 認証ユーザーが追加された瞬間に「全員が全プロジェクト見える」状態になる
> → ユーザー追加前に organization_id 埋めと multi-tenant policy 化が必要

新規登録した検証用アカウント (自前作成→検証後削除済) から、ラポルタの
**実顧客案件が全件読めた**。`/#/signup` は本番で公開されており、
このまま告知すれば登録者全員が同じテナントに入る。

| テーブル | 実データ件数 | 新規ユーザーが読めた件数 |
|---|---|---|
| projects | 4 | **4 (100%)** |
| tasks | 34 | **34 (100%)** |
| documents | 4 | **4 (100%)** |
| organizations | 5 | 1 |
| estimates/invoices/contractors/photos | 0 | 0 (空のため判定不能) |

データのある卓は全て素通し。RLS はテナント分離として機能していない。

## 成果物

| ファイル | 用途 |
|---|---|
| `prod-e2e.mjs` | 新規登録フォームの構造ダンプ + signup 実行 |
| `prod-flow.mjs` | 主要フローE2E: ログイン → 案件作成 → 見積 → 請求 |
| `bypass-check.mjs` | `window.__E2E_BYPASS_AUTH__` が本番で有効か否かの実測 |
| `evidence/` | 各ステップのスクショ + 実行ログ |

再実行:

```sh
RUN_STAMP=xx E2E_EMAIL=... E2E_PASSWORD=... \
  node docs/saas-launch-verify-20260721/prod-flow.mjs
```

## 検証後の後始末 (実施済み)

- E2Eで作成した案件2件を DELETE 済み。本番の案件は元の4件に復帰を確認
- 検証用 auth ユーザー `e2e-20260721@laporta.co.jp` を admin API で削除済み
  (残ユーザー3件はいずれも既存のもの: niiyama@, niiyama+audit0705@, niiyama+audit20260712@)
- 実顧客データの変更・削除はゼロ。Stripe 本番課金・実メール送信はいずれも未実行
