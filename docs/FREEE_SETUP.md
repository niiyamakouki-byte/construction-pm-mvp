# freee 連携セットアップ手順

GenbaHub の `/freee` ページは freee 会計の OAuth 連携で請求書・取引を取得する。
本ドキュメントは freee developer アプリ作成から Vercel 環境変数登録までの手順をまとめる。

Phase 1 の範囲:
- OAuth 2.0 による連携（authorization code grant）
- access_token / refresh_token を Supabase `freee_tokens` テーブルに保管
- 事業所 / 請求書 / 取引 の読み取り専用 API

Phase 2 以降:
- 入金↔請求書の自動照合
- Supabase `expenses` テーブルへの同期
- webhook（リアルタイム更新）

---

## 1. freee developer アプリを作成

1. [https://app.secure.freee.co.jp/developers/api](https://app.secure.freee.co.jp/developers/api) にアクセス。
2. ログイン後、**アプリの新規追加** を押す。
3. アプリ種別: **プライベートアプリ** を選択（社内利用なら十分）。
4. 以下を入力:
   - 名称: `GenbaHub`（任意）
   - 用途説明: `建設業向け現場管理 SaaS と freee の連携`
5. 作成後、**Client ID** と **Client Secret** をコピー。
6. **コールバック URL** に以下を登録:
   - 本番:   `https://<project>.vercel.app/api/freee/callback`
   - 開発:   `http://localhost:3000/api/freee/callback`
7. 必要な **スコープ** を有効化:
   - `read`（読み取り）— Phase 1 はこれだけでよい
   - `write`（書き込み）— Phase 2 で入金記録等を書く場合に追加

## 2. ローカル開発用 `.env.local`

リポジトリルートの `.env.local` に以下を追記（`.gitignore` 済みであること）。

```env
# freee (クライアント公開値。Vite がビルド時に埋め込む)
VITE_FREEE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx

# freee (サーバー側のみ。Vercel Function から参照)
FREEE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxx
FREEE_REDIRECT_URI=http://localhost:3000/api/freee/callback
```

ローカルで Vercel Function を動かすには `vercel dev` を使う:

```bash
vercel dev   # http://localhost:3000
```

> `pnpm dev`（Vite 単体）では `/api/freee/*` は 404 になる点に注意。

## 3. Vercel の環境変数に登録

Vercel ダッシュボード → Project → Settings → Environment Variables、または CLI:

```bash
vercel env add VITE_FREEE_CLIENT_ID  preview production
vercel env add FREEE_CLIENT_SECRET   preview production
vercel env add FREEE_REDIRECT_URI    preview production
```

`FREEE_REDIRECT_URI` は環境ごとに違う値にする:
- preview:    `https://<preview>.vercel.app/api/freee/callback`
- production: `https://<prod-domain>/api/freee/callback`

設定後は再デプロイ:

```bash
vercel deploy --prod
```

## 4. Supabase マイグレーションを適用

```bash
supabase migration up   # supabase CLI を使う場合
# または SQL エディタで supabase/migrations/021_freee_tokens.sql を流す
```

作成されるテーブル: `public.freee_tokens`
- `user_id` で unique（ユーザー 1 人につき 1 連携）
- `access_token`, `refresh_token`, `expires_at`, `company_id` を保管
- RLS 有効、Select/Delete のみ自分の行に対して許可

## 5. 動作確認（手動テスト）

1. アプリにログイン後 `/#/freee` を開く。
2. **freee に接続** を押すと freee の同意画面に遷移する。
3. 同意後 `/#/freee?code=...` で戻ってくる → SPA が自動で `/api/freee/callback` に POST する。
4. 成功すると「接続済み」状態になり、**事業所を取得** ボタンが出る。
5. 事業所を選んで **請求書を取得** / **取引を取得** を押すと、表形式で結果が表示される。

## 6. 実装ファイルの対応表

| ファイル | 役割 |
| --- | --- |
| `src/lib/freee-client.ts` | OAuth 認可 URL 生成 / token 交換 / refresh |
| `src/lib/freee-api.ts` | `FreeeApi` クラス（3 エンドポイント + 自動 refresh） |
| `src/lib/freee-oauth-handler.ts` | callback のテスタブルコア |
| `src/lib/freee-api-handler.ts` | /api/freee/* の共有ハンドラ |
| `src/lib/freee/client.ts` | 既存: 固定トークン用 REST クライアント（別系統・温存） |
| `api/freee/auth.ts` | GET /api/freee/auth — 認可 URL を返す |
| `api/freee/callback.ts` | POST /api/freee/callback — code を token に交換 |
| `api/freee/companies.ts` | GET /api/freee/companies |
| `api/freee/invoices.ts` | GET /api/freee/invoices?company_id=... |
| `api/freee/deals.ts` | GET /api/freee/deals?company_id=... |
| `src/pages/FreeePage.tsx` | `/#/freee` — 連携 UI |
| `supabase/migrations/021_freee_tokens.sql` | `freee_tokens` テーブル |

## 7. トークン有効期限と refresh

freee のアクセストークンは **6 時間** で失効する。`FreeeApi` は以下を自動で行う:

- 呼び出し前に `expires_at` をチェックし、60 秒以内に切れるなら先に `refresh_token` で更新
- それでも 401 が返ったら 1 度だけ強制 refresh してリトライ
- 新しいトークンは `freee_tokens` テーブルに `upsert`

`refresh_token` 自体は（freee 仕様上）1 回の refresh で使い捨てになり、
レスポンスに含まれる新しい `refresh_token` で置き換える必要がある。`FreeeApi.forceRefresh()`
はこの置き換えまで込みで `store.save()` を呼ぶ。

## 8. 連携解除

ユーザーが連携を解除したい場合は Supabase 上の `freee_tokens` から
自分の行を削除する（RLS で許可済み）。UI 追加は Phase 2。

## テスト

- `src/lib/freee-client.test.ts` — OAuth ユーティリティ（5 ケース）
- `src/lib/freee-oauth-handler.test.ts` — code 交換 + 保存（4 ケース）
- `src/lib/freee-api.test.ts` — API wrapper + refresh（10 ケース）
- `src/lib/freee-api-handler.test.ts` — /api/freee/* ハンドラ（6 ケース）
