# トライアル → 有料転換 状態遷移設計

作成日: 2026-07-05
対象: GenbaHub（仮称。ブランド名は `src/lib/brand.ts` の `BRAND_NAME` 参照。リブランド判断待ち）

## 現状（実装済み範囲の棚卸し）

- `organizations.plan` は作成時に `'trial'` がデフォルト（`supabase/migrations/003_organizations.sql`）。
- しかし `SubscriptionContext.normalizePlan()`（`src/contexts/SubscriptionContext.tsx`）は
  `"trial"` を未知の値として扱い、実質 **`free`（プロジェクト1件・タスク20件まで）に丸めている**。
  → 今日時点では「14日間フル機能トライアル」は存在せず、新規organizationは無料枠に張り付く。
- `organizations` に `trial_ends_at` のようなトライアル期限カラムは存在しない（`created_at`のみ）。
- `subscriptions.status` は `active / canceled / past_due / trialing / incomplete` を既に許容しており、
  Stripe側 `trialing` ステータスの受け皿はスキーマ上ある（`supabase/migrations/010_subscriptions.sql`）。
- Stripe Checkout（`api/checkout-session.ts` → `src/lib/checkout-session.ts`）は **trial_period_days 未設定**。
  現状はCheckout完了 = 即課金開始の実装。

本docは上記ギャップを踏まえ、オーナーGOが出た時点で実装すべき状態遷移を定義する。
**コード変更は本タスクのスコープ外**（料金ページ追加とdoc追加が主）。実装フェーズで下記を参照する。

## 状態一覧

| 状態 | 判定条件 | 意味 |
|---|---|---|
| `trial_active` | `organizations.plan = 'trial'` かつ `now() < trial_ends_at` | 登録から14日以内。全機能（Proと同等）を無料開放 |
| `trial_expiring_soon` | `trial_active` かつ 残り日数 ≤ 3日 | UI上の警告バナー表示のみ。機能制限はまだ無し |
| `trial_expired` | `organizations.plan = 'trial'` かつ `now() >= trial_ends_at` かつ有効なStripeサブスクなし | free相当の制限にダウングレード（データは保持） |
| `converting` | Stripe Checkout Session作成〜`checkout.session.completed` Webhook到達まで | 決済処理中。ボタンはローディング表示 |
| `paid_active` | `subscriptions.status = 'active'`（plan = standard/pro） | 通常利用。制限なし |
| `payment_failed` | `subscriptions.status = 'past_due'`（`invoice.payment_failed` Webhook経由） | 利用は継続可だが警告バナー表示。数日で自動リトライ（Stripe側） |
| `canceled` | `subscriptions.status = 'canceled'`（`customer.subscription.deleted` Webhook経由） | free相当にダウングレード |

## 画面挙動

### trial_active
- グローバルバナー（ヘッダー直下）: 「トライアル残り n 日」+ 「プランを見る」リンク（`/pricing`へ）。
- 機能制限なし（Standard/Proの全機能を開放。どちらの価格帯を案内するかはトライアル終了時の選択に委ねる）。
- `/pricing` では「トライアル中」ラベルを現在プラン表示に出し、両プランに「今すぐアップグレード」ボタンを出す
  （早期決済でトライアル残日数を切り上げてよい。Stripe Checkoutの`trial_period_days`と組み合わせる場合は
  Stripe側のtrial終了日を基準にするため、アプリ側`trial_ends_at`とズレないよう設計時に一本化すること）。

### trial_expiring_soon
- バナー文言を強調（例: 「トライアルはあと3日で終了します」）。色は警告用amberのみ許可
  （`docs/minimalist-sage-ui.md` の「状態色は例外として保持してよい」に準拠、他は単色セージ維持）。

### trial_expired
- 新規作成系の操作（案件追加・タスク追加）は既存の `canCreateProject` / `canAddTask`
  （`SubscriptionContext.ts`）のfree枠ロジックがそのまま使える設計にする。
- 既存データの閲覧は制限しない（解約時と同じ「読めるが増やせない」挙動）。
- ダッシュボードに「トライアルが終了しました。継続するには有料プランへの登録が必要です」を表示し、
  `/pricing` への導線を常時表示。

### converting
- `/pricing` の該当プランボタンは `処理中...` 表示（実装済み: `PricingPage.tsx`の`checkoutLoading`）。
- Stripe Checkoutへリダイレクト後、成功は `/#/pricing/success`、キャンセルは `/#/pricing/cancel`
  （両方実装済み: `PricingSuccessPage.tsx` / `PricingCancelPage.tsx`）。

### paid_active
- バナー非表示。`/pricing` の現在プラン欄に契約プランを表示。

### payment_failed
- バナー: 「お支払いに失敗しました。カード情報をご確認ください」+ Stripe Customer Portalへのリンク
  （Customer Portal自体は未実装 → 実装時に `api/` 配下へポータルセッション作成エンドポイントを追加する）。

### canceled
- `trial_expired` と同じダウングレード挙動 + 「再開する」導線を`/pricing`に表示。

## 実装時に必要な追加（未着手・提案のみ）

1. `organizations` に `trial_ends_at timestamptz` を追加するマイグレーション（例）:

   ```sql
   alter table public.organizations
     add column if not exists trial_ends_at timestamptz;

   -- 新規作成時に created_at + 14日 を自動セット（トリガー or アプリ側で明示セット）
   update public.organizations
     set trial_ends_at = created_at + interval '14 days'
     where trial_ends_at is null and plan = 'trial';
   ```

2. `SubscriptionContext.normalizePlan()` を拡張し、`trial` かつ期限内なら `pro` 相当の機能開放、
   期限切れなら `free` にフォールバックするロジックを追加（`trial_ends_at` をorganizationsから取得）。
3. Stripe Customer Portal連携（カード変更・解約のセルフサービス化）。現状は
   `info@laporta.co.jp` への問い合わせ導線のみ（`PricingPage.tsx`）。

## Stripe結線: テストモード→実キー差し替え手順

既存のテストモード実装（`STRIPE_SETUP.md`）を前提に、**実キー差し替えのみ**で本番へ進める設計になっている。
コード変更は不要、以下の環境変数差し替えのみで足りる（`STRIPE_SETUP.md` セクション8と同一手順、詳細はそちらを参照）。

1. Stripeダッシュボードで `pk_live_...` / `sk_live_...` を取得。
2. 本番Product/Priceを作成（¥20,000 / ¥30,000、オーナー最終確定後の金額で）。
3. Vercel環境変数を差し替え:
   - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
   - `STRIPE_TEST_SECRET_KEY` = 本番 `sk_live_...`（現状の実装は本番/テストで変数名を分けていないため、
     このキー名のまま本番シークレットを入れる運用。将来的に `STRIPE_SECRET_KEY` へ分離を検討）
   - `VITE_STRIPE_PRICE_STANDARD` / `VITE_STRIPE_PRICE_PRO` = 本番Price ID
   - `STRIPE_WEBHOOK_SECRET` = 本番Webhookのsigning secret
4. 本番Webhookエンドポイントを登録（`checkout.session.completed` / `customer.subscription.updated` /
   `customer.subscription.deleted` / `invoice.payment_failed`）。
5. 再デプロイ。コードの変更は一切不要（`isStripeConfigured()` が `pk_live_` prefixも許容する実装のため）。

**禁止事項**: 実キーの投入・本番デプロイは今回のタスク範囲外。オーナーGOが出てから上記手順を実行する。
