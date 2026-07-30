# push解禁判断パッケージ — construction-pm-mvp (2026-07-30)

owner判断用。**このセッションではpushしていない。**

## 1. ブランチ現況

- 作業ブランチ: `design/ui-facelift-20260728`（upstream未設定、origin未追跡）
- `origin/main` との差分: `git rev-list --left-right --count origin/main...HEAD` → **ahead 21 / behind 0**
  - 今朝の判断待ちで出ていた「ahead 14」から、本日の検証ループ・アダプタ準拠化・テスト緑化で **+7コミット追加**（06:46〜11:51の間、下記「今日の分」）

### 今日の分（2026-07-30、8コミット）

| commit | 時刻 | 内容 |
|---|---|---|
| a5f33ab | 11:51 | test(cost-management): 予算未設定表示テスト修正(bnu) |
| b995cf3 | 11:47 | fix(adapter): 旧22アダプタへisE2EBypass準拠を展開、監査ベースライン0化(9ay) |
| 003a4e5 | 11:36 | test(audit): 空状態デッドロック検出+アダプタE2Eバイパス準拠監査スクリプト新設(rc07y) |
| 584095d | 11:25 | fix(freee): /invoices/reconcile の生Supabaseスキーマエラー修正(mt9d5) |
| bae4987 | 11:15 | 検証ループ3周目: 深リンク×初回セッション全ルート網羅、/scheduleの詰みバグ修正 |
| 4455c56 | 11:04 | 検証ループ2周目: タスク状態遷移/CRM顧客登録/日報プレビュー実走、reportsの案件0件行き詰まり修正 |
| ada7e1b | 10:54 | test(e2e): 検証ループ回帰テスト追加 |
| 2746f6f | 06:46 | feat(site-entry): entry_token方式でanon QRチェックインのRLSギャップ対応 |

### それ以前の分（2026-07-22〜07-29、13コミット）

| commit | 日付 | 内容 |
|---|---|---|
| 2a335cc | 07-29 | fix(auth): 初回サンプル案件シードをAuthGuard準備完了までゲート |
| 0ba544c | 07-29 | fix(today): GreetingHeaderのハードコード天気stub削除 |
| b4146da | 07-29 | docs: push必須記述を除去（friction一斉掃引） |
| 0fc140d | 07-29 | fix(share-tokens): /share-tokensへの戻り導線・案件詳細からの発行導線追加 |
| 32b33f8 | 07-29 | fix(cost-management): 予算未設定時は残予算も『未設定』表示に統一 |
| 0bc154b | 07-29 | fix(pricing): 未ログイン訪問者に「現在のプラン」ラベルを非表示化 |
| da72f47 | 07-28 | fix(stripe): webhook処理を冪等化 |
| 33f3f99 | 07-28 | fix(estimate-assistant): モバイルブレークポイント追加、死bg-sage-100クラス削除 |
| a88f0b0 | 07-27 | fix(share-token): 共有リンクをサーバー署名HMAC経由に変更、localStorage方式を本線から除去 |
| 896b81e | 07-27 | test(share-token): クロスデバイス起動失敗を再現するテスト |
| 1968fc7 | 07-27 | fix(security): share-token HMAC署名をクライアント側から排除（HIGH、07-27監査） |
| 2549142 | 07-26 | fix(deps): brace-expansion/@hono-node-server の高深刻度CVEにoverride固定 |
| d3055b3 | 07-22 | fix(ui): app shellの整列・テーマコントラスト修正 |

## 2. リスク評価

全スイート・監査・静的解析を本日11:52〜11:54実測（下記「3. 実測結果」参照。全緑）。

### 安全（テスト/監査/バグ修正・表示に外部影響なし） — 11件
`2549142` `1968fc7` `896b81e` `b4146da` `ada7e1b` `4455c56` `bae4987` `584095d` `003a4e5` `b995cf3` `a5f33ab`

- CVE修正(2549142)、share-token HMACをサーバー側に寄せるセキュリティ強化(1968fc7)、回帰テスト追加、bugfixはいずれもテストで裏付け済み。`b995cf3`は22アダプタへの機械的な準拠展開だが、監査スクリプト実測で非準拠0件を確認済み（下記3参照）。

### 表示に影響（UI変更・要目視確認だが機能破壊リスクは低い） — 6件
`d3055b3` `33f3f99` `0bc154b` `32b33f8` `0fc140d` `0ba544c`

- app shell整列/コントラスト、モバイルブレークポイント、料金プランラベル出し分け、予算未設定表示統一、共有リンク導線追加、天気stub除去。いずれも単一画面の表示調整で、ロジック分岐の破壊的変更は含まない。

### 要注意（動作・認可まわりの変更、目視+実データでの再確認推奨） — 4件
`a88f0b0` `da72f47` `2a335cc` `2746f6f`

- `a88f0b0`: 共有リンクの生成方式そのものを変更（旧localStorage方式除去）。**既存に発行済みの旧方式リンクが無効化される可能性**があるため、稼働中の共有リンクの有無を確認してからpushするのが安全。
- `da72f47`: Stripe webhook冪等化。決済系のためコード自体は安全側の変更だが、本番環境変数・Webhook設定はowner確認対象（Stripeダッシュボード操作はエージェント禁止のため、pushしても設定変更は別途owner作業）。
- `2a335cc`: 初回サンプル案件シードのタイミングをAuthGuard待ちに変更。初回ログイン体験に影響するため実機確認推奨。
- `2746f6f`: anon QRチェックイン用の新RLSスキーム追加。新規の認可経路のため、本番RLS設定への反映有無を要確認。

## 3. 実測結果（2026-07-30 11:52〜11:54 JST 再実測）

| 項目 | コマンド | 結果 |
|---|---|---|
| 全テストスイート | `pnpm run test` | **594 test files passed / 8354 tests passed / 3 skipped（0 failed）** |
| アダプタE2Eバイパス監査 | `node scripts/audit-adapter-e2e-bypass.mjs` | `TOTAL_NONCOMPLIANT=0` |
| 空状態監査（参考・非ブロッキング） | `node scripts/audit-empty-states.mjs` | `TOTAL_FLAGGED=25`（EmptyStateコンポーネント未使用ページの検出のみ、exit 0＝警告扱い） |
| 型チェック | `pnpm run typecheck`（tsc x2） | **エラー0** |
| Lint | `pnpm run lint`（`--max-warnings 0`） | **エラー0・警告0** |

## 4. 残存WIP棚卸し（作業ツリー、未commit）

`design/ui-facelift-20260728` ブランチ上の継続作業。index.html/index.cssのコメントに設計意図が明記されており、同一ブランチ・同一系統の作業（他者混入や由来不明の変更ではない）。

| ファイル | 内容 | 由来手がかり |
|---|---|---|
| `index.html` | Shippori Mincho B1 / Zen Kaku Gothic New のGoogle Fonts読込追加 | `<!-- Design facelift 2026-07-28 (branch design/ui-facelift-20260728) -->` コメントあり |
| `src/index.css` | `--font-heading` `--font-figure` `--font-label` トークン、`.hero-heading` `.figure-hero` `.eyebrow-label` `.genba-flat-card` ユーティリティ追加 | 「Design facelift 2026-07-28」ブロックコメントでスコープ明記（本文フォントは意図的に据え置き、と明記） |
| `src/components/DashboardCard.tsx` | 上記ユーティリティクラスの適用、shadow-smをgenba-flat-cardへ置換 | 同上ブランチの一貫した適用 |
| `src/components/GreetingHeader.tsx` | 同上 + コントラスト実測コメント（brand-500が3.17:1でAA未達のためbrand-700へ変更、と明記） | 同上 |
| `src/pages/EstimatePage.tsx` | 合計金額表示・見出しへの適用 | 同上 |
| `src/pages/TodayDashboardPage.tsx` | 本日概要カード・StatCard・DashboardSummaryCardへの適用 | 同上 |
| `.beads/interactions.jsonl` | bd操作の自動ログ追記（9ay/bnu票のクローズ記録） | bdツールが自動追記、コード変更ではない |
| `tasks/87di3-verify/after/*.png`（4枚） | 検証スクリーンショットの再撮影による差分 | ファイル名から87di3検証タスクの証跡更新と判明 |

**push時の扱い**: これらは未commitのままworking treeに残る。commitしない限りpushには含まれない＝push実行そのものへの影響はない。ただし `git push` 前に `git stash` 等でリセットする操作は不要（pushはHEADのcommit履歴のみを送る）。

## 5. push手順

1. **ブランチ方針**: `design/ui-facelift-20260728` はUI facelift用の作業ブランチで、21コミット中17件（安全11+UI6）は facelift 以外の独立した修正・機能追加が混在している。リポジトリはこれまで一貫して `main` に直接コミットして進めてきた運用（過去のcommit historyがすべて `main` 直系）ため、facelift未完了のWIPを分離してから push するなら:
   - オプションA（推奨・最短）: 現在の未commit WIP（表4）を一旦 `git stash` するか、facelift用に別途commitして残し、`design/ui-facelift-20260728` ブランチ自体を `main` へ `git push origin design/ui-facelift-20260728:main` する（fast-forward、21コミットすべてが乗る）
   - オプションB: facelift関連コミットを一旦除外し、安全+UI+要注意の21コミットのうちfacelift由来でない20コミット（`33f3f99` estimate-assistant以外はfacelift外）をmainへ、facelift仕上げ後に別PRで統合
   - 光輝さんの「変更したら細かくcommit+push」運用実績から見て、オプションAが素直（このリポジトリはPRを介さずmain直push運用）
2. **実行コマンド**（LAP_ALLOW_PUSH=1手順）:
   ```
   cd ~/construction-pm-mvp
   LAP_ALLOW_PUSH=1 git push origin design/ui-facelift-20260728:main
   ```
3. **push後の自動デプロイ**:
   - GitHub Actions `deploy.yml`: `push: branches: [main]` で発火 → GitHub Pagesへビルド・デプロイ
   - GitHub Actions `ci.yml`: `push/pull_request: branches: [main]` で発火 → lint/typecheck/test（現状すべて緑のため通過見込み）
   - **Vercel**: プロジェクト `construction-pm-mvp`（`prj_k5GyhthBDAjITRzsIjcGTWWEFrr1`）はGitHub連携済みで `construction-pm-mvp-git-main-*.vercel.app` ドメインを保持 → **mainへのpushで自動的に本番デプロイが走る**（Vercel Git Integration、ワークフローファイル不要）。直近の本番デプロイは同日既に反映済み（`latestDeployment.target: production`, `readyState: READY`）。
   - 決済ダッシュボード(Stripe)の設定変更は本push作業に含まれない・別途owner操作。

## 6. 推奨

- コード品質面（テスト/監査/lint/typecheck）は push 可能な状態。ブロッカーなし。
- 判断が要るのは「要注意」4件（特に `a88f0b0` 共有リンク方式変更、`2746f6f` 新RLS経路）と、facelift WIPをどう扱うか（stash/commit/別ブランチ）の2点。
- 上記を確認できればオプションAの1コマンドでpush可能。
