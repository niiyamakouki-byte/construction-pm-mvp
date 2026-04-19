# Stripe テストモード設定手順

GenbaHub の料金ページ (`/pricing`) は Stripe Checkout で決済を行う。
本番鍵が用意できるまでは **TEST MODE** のみで動かす想定。
本ドキュメントはテスト鍵の取得〜Vercel への反映、Webhook 登録までの手順をまとめる。

---

## 1. Stripe ダッシュボードでテスト鍵を取得

1. [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) にアクセスし、**Viewing test data** をオンにする。
2. 以下 2 つの鍵をコピー。
   - **Publishable key**  `pk_test_...`
   - **Secret key**       `sk_test_...`

## 2. テスト用 Price を作成

1. [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products) で Product を 2 件作成:
   - `GenbaHub Standard` — Recurring, ¥2,980 / month
   - `GenbaHub Pro`      — Recurring, ¥9,800 / month
2. それぞれの Price ID (`price_...`) をコピー。

## 3. ローカル開発用 `.env.local`

リポジトリルートに `.env.local` を作成（`.gitignore` 済みであること）。

```env
# クライアント側 (Vite がビルド時に埋め込む)
VITE_STRIPE_TEST_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_STANDARD=price_xxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_PRO=price_xxxxxxxxxxxxxxxx

# サーバー側 (Vercel Function でのみ参照)
STRIPE_TEST_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx

# Webhook 検証用 (後述のステップ 5 で取得して設定)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# 任意: 本番以外で Checkout の戻り URL を明示したい場合
# APP_BASE_URL=https://your-preview.vercel.app
```

ローカルで Stripe Function を動かすには `vercel dev` を使うのが最も簡単:

```bash
pnpm add -g vercel  # 未インストールなら
vercel link         # 初回のみ
vercel dev          # http://localhost:3000 で /api/* も利用可
```

> `pnpm dev`（Vite 単体）では `/api/checkout-session` は 404 になる点に注意。

## 4. Vercel の環境変数に同じ内容を登録

Vercel ダッシュボード → Project → Settings → Environment Variables、
または CLI:

```bash
# プレビュー/本番の両方で設定する例
vercel env add VITE_STRIPE_TEST_PUBLIC_KEY preview production
vercel env add VITE_STRIPE_PRICE_STANDARD  preview production
vercel env add VITE_STRIPE_PRICE_PRO       preview production
vercel env add STRIPE_TEST_SECRET_KEY      preview production
vercel env add STRIPE_WEBHOOK_SECRET       preview production
```

設定後は再デプロイが必要:

```bash
vercel deploy --prod
```

## 5. Webhook エンドポイントを登録

Vercel にデプロイした URL が確定してから行う。

1. [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks) で **Add endpoint** をクリック。
2. Endpoint URL: `https://<your-deployment>.vercel.app/api/stripe-webhook`
3. Listen to: 以下のイベントを購読。
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. 作成後に表示される **Signing secret** (`whsec_...`) をコピーし、
   Vercel の `STRIPE_WEBHOOK_SECRET` に設定して再デプロイ。

> Webhook ハンドラ (`api/stripe-webhook.ts`) は現在 **署名検証 + 受信ログまで** が
> 実装済み。`public.subscriptions` 行の更新ロジックは TODO コメント済みなので、
> endpoint 登録後にプルリクでコードを埋める想定。

## 6. 動作確認（手動テスト）

1. アプリの `/pricing` を開く。
2. **スタンダードプランを選択** → `checkout.stripe.com` へリダイレクト。
3. テスト用カード番号 `4242 4242 4242 4242` / 任意の将来の有効期限 / 任意の CVC で支払い。
4. 成功後 `/#/pricing/success?session_id=cs_test_...` に戻り、緑の成功画面が表示される。
5. キャンセル時は `/#/pricing/cancel` に戻り、琥珀色のキャンセル画面が表示される。
6. Stripe ダッシュボードの **Payments → All transactions** に TEST 扱いの決済が記録されていることを確認。

### 代表的な失敗カード（Webhook `invoice.payment_failed` 用）

- `4000 0000 0000 0341` — decline after attaching
- `4000 0000 0000 9995` — insufficient funds

## 7. Supabase 側のマイグレーション

```bash
supabase migration up   # supabase CLI を使う場合
# または SQL エディタで supabase/migrations/019_checkout_sessions.sql を流す
```

テーブル: `public.checkout_sessions` が作成され、Stripe Session 作成履歴のログに使える
（`public.subscriptions` は migration 010 で作成済み）。

## 8. 本番鍵への切り替え（将来）

1. Stripe ダッシュボードで **Viewing test data** をオフにし、`pk_live_...` / `sk_live_...` を取得。
2. 本番 Product / Price も作成。
3. Vercel の環境変数を以下で差し替え:
   - `VITE_STRIPE_PUBLISHABLE_KEY` に `pk_live_...`（`VITE_STRIPE_TEST_PUBLIC_KEY` が未設定なら自動でこちらを使う）
   - `STRIPE_TEST_SECRET_KEY` は一旦そのまま本番 secret に差し替えるのが現状の実装（将来 `STRIPE_SECRET_KEY` 分離予定）
4. Webhook も本番ダッシュボードで同じ手順で登録し、本番 `whsec_...` を `STRIPE_WEBHOOK_SECRET` に反映。

---

## 実装ファイルの対応表

| ファイル | 役割 |
| --- | --- |
| `src/lib/stripe.ts` | クライアント側 Stripe.js ロード + Plan 定義 |
| `src/lib/checkout-session.ts` | Checkout Session 作成のテスタブルコア |
| `src/__tests__/checkout-session.test.ts` | 上記のユニットテスト（8 ケース） |
| `api/checkout-session.ts` | Vercel Function: POST /api/checkout-session |
| `api/stripe-webhook.ts` | Vercel Function: POST /api/stripe-webhook（スタブ） |
| `src/pages/PricingPage.tsx` | `/pricing` — Checkout 起動 |
| `src/pages/PricingSuccessPage.tsx` | `/#/pricing/success` |
| `src/pages/PricingCancelPage.tsx` | `/#/pricing/cancel` |
| `supabase/migrations/010_subscriptions.sql` | `subscriptions` テーブル（Webhook が更新） |
| `supabase/migrations/019_checkout_sessions.sql` | `checkout_sessions` ログテーブル |

## テストについて

- `createCheckoutSession` はユニットテスト済み (Stripe SDK をモック注入)。
- **E2E テスト（実 Stripe への通信を含むブラウザ遷移）は、実テスト鍵と `vercel dev` 等の環境が必要なため
  現時点では未実装**。鍵が揃った段階で `e2e/` 配下に Playwright シナリオを追加する想定。
