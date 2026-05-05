# LINE Login 設定手順

GenbaHub で LINE ログイン / LINE 登録を有効化するための設定手順。

---

## 1. LINE Developers Console での設定

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダーを作成（または既存のプロバイダーを選択）
3. **新しいチャネル** を作成 → 種類: **LINE Login**
4. チャネル設定:
   - チャネル名: `GenbaHub`（任意）
   - チャネル説明: 建設プロジェクト管理プラットフォーム（任意）
   - アプリの種類: **ウェブアプリ** にチェック
5. 作成後、**チャネル基本設定** タブから以下を取得:
   - **チャネル ID** → `VITE_LINE_CHANNEL_ID`
   - **チャネルシークレット** → `VITE_LINE_CHANNEL_SECRET` (暫定) / `LINE_CHANNEL_SECRET` (Edge Function)

### コールバック URL 設定

**LINE Login** タブ → **コールバック URL** に以下を追加:

```
# ローカル開発
http://localhost:5173/auth/line/callback

# 本番
https://construction-pm-mvp.vercel.app/auth/line/callback
```

---

## 2. Supabase Auth の設定

LINE の Custom OAuth Provider は Supabase の **signInWithIdToken** API を使って実装している。

### 必要な設定

1. [Supabase Dashboard](https://app.supabase.com/) → プロジェクト選択
2. **Authentication** → **Providers** → **LINE** を有効化
   - Client ID: LINE チャンネル ID
   - Client Secret: LINE チャンネルシークレット
3. **Redirect URL** に以下を追加:
   ```
   https://construction-pm-mvp.vercel.app/auth/line/callback
   ```

> **NOTE**: Supabase が LINE Custom OAuth Provider に対応していない場合、
> `signInWithIdToken` に `provider: "line"` を指定する方式を使用する。
> この場合、LINE の id_token を直接 Supabase に渡して JWT 検証を行う。

---

## 3. 環境変数の設定

### ローカル開発 (`.env.local`)

```env
VITE_LINE_CHANNEL_ID=your_line_channel_id
VITE_LINE_CHANNEL_SECRET=your_line_channel_secret
```

### Vercel 本番環境

```bash
vercel env add VITE_LINE_CHANNEL_ID
vercel env add VITE_LINE_CHANNEL_SECRET
```

> **セキュリティ注意**: `VITE_LINE_CHANNEL_SECRET` はフロントエンドのバンドルに含まれるため、
> 本番環境では Supabase Edge Function に移行してクライアントに公開しないこと。
> 詳細は「Edge Function への移行」セクションを参照。

---

## 4. OAuth フロー概要

```
ユーザー
  │ LINE で登録/ログイン ボタンをクリック
  ▼
startLineLogin() [src/lib/line-oauth.ts]
  │ state を sessionStorage に保存
  │ LINE 認可ページへリダイレクト
  ▼
LINE 認可ページ
  │ ユーザーが許可
  │ code + state を付けてコールバックへリダイレクト
  ▼
/auth/line/callback [LineCallbackPage.tsx]
  │ state を検証 (CSRF 防止)
  │ exchangeLineCode(code) → id_token 取得
  │ supabase.auth.signInWithIdToken({ provider: "line", token: id_token })
  ▼
/app (ログイン完了)
```

---

## 5. VITE_LINE_CHANNEL_SECRET の Edge Function 移行 (推奨)

現在の実装はクライアントサイドで LINE token endpoint を呼び出すため、
`VITE_LINE_CHANNEL_SECRET` がフロントエンドバンドルに含まれる。
本番環境では以下の手順で Supabase Edge Function に移行すること。

### Edge Function の作成

```typescript
// supabase/functions/line-token-exchange/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { code, redirectUri } = await req.json()

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: Deno.env.get("LINE_CHANNEL_ID")!,
    client_secret: Deno.env.get("LINE_CHANNEL_SECRET")!,
  })

  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  })
})
```

### Edge Function への Secrets 設定

```bash
supabase secrets set LINE_CHANNEL_ID=your_channel_id
supabase secrets set LINE_CHANNEL_SECRET=your_channel_secret
```

---

## 6. テスト手順

1. `.env.local` に `VITE_LINE_CHANNEL_ID` と `VITE_LINE_CHANNEL_SECRET` を設定
2. `pnpm dev` でローカルサーバー起動
3. `/signup` または `/login` にアクセス
4. **LINE で登録** / **LINE でログイン** ボタンが有効になっていることを確認
5. ボタンをクリックして LINE 認可ページへ遷移することを確認
6. 認可後、`/auth/line/callback` を経由して `/app` にリダイレクトされることを確認

> **env 未設定時**: ボタンは `disabled` 状態になり、壊れた動作にはならない。
