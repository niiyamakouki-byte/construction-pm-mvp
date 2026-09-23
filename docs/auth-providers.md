# ログイン手段（Google の次に Apple → マジックリンク → パスキー）

Google の手順と、本番で先に通す確認は [auth-google.md](./auth-google.md)。ここは同じ Supabase Auth に足す残りの手段。秘密情報は Dashboard にだけ置き、リポジトリには書かない。

クライアントは `@supabase/supabase-js` 2.117。セッションは PKCE、`localStorage`（Android WebView では常にこちら）、トークン自動更新。

## 共通の Redirect URLs

Supabase → Authentication → URL Configuration → Redirect URLs:

```
https://construction-pm-mvp.vercel.app/**
https://construction-pm-mvp.vercel.app/
http://localhost:5173/**
http://localhost:5173/
http://localhost:3000/**
http://localhost:3000/
https://localhost/**
https://localhost/
jp.co.laporta.genbahub://auth/callback
```

Site URL: `https://construction-pm-mvp.vercel.app`

ネイティブの戻り（Google も Apple も）は `jp.co.laporta.genbahub://auth/callback`。メールのマジックリンクはメールアプリが開くため、Android からも本番の `https://construction-pm-mvp.vercel.app/` に戻す。アプリ内では 6 桁コードも受け付ける。

## 2. Sign in with Apple

Supabase → Authentication → Providers → Apple → Enable。

入れる値（Apple Developer で発行。ファイルには置かない）:

- Services ID
- Team ID
- Key ID
- Secret Key（.p8 の中身）

Apple の Services ID の Return URL は Supabase のコールバックだけ:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

アプリ側は `signInWithOAuth({ provider: "apple", scopes: "name email" })`。Capacitor では Google と同じくシステムブラウザを開く。

App Store に出す場合: 他のソーシャルログインがあるなら Sign in with Apple が必須（Guideline 4.8）。iOS の WKWebView でも WebView 内完結は避け、同じカスタムスキームで戻す。Android だけならこの審査条件はまだ掛からない。

## 3. マジックリンク

Supabase → Authentication → Providers → Email を有効にする。

メールテンプレート（Magic Link）には `{{ .ConfirmationURL }}` を残す。6 桁コードも使うなら同じテンプレートに `{{ .Token }}` を足す。コードだけにしてリンクを消すと、メールアプリからアプリへ戻る経路が無くなる。

「Confirm email」はオンのままでよい。マジックリンクのクリック、またはコード確認でメール確認済みになる。

アプリは `signInWithOtp` の `emailRedirectTo` に上の戻り先を渡す。画面にコード欄を出し、`verifyOtp({ type: "email" })` で今の WebView にセッションを作る。

## 4. パスキー（WebAuthn）

Supabase → Authentication → Passkeys → Enable。

| 項目 | 値 |
| --- | --- |
| Relying Party Display Name | LapoSite |
| Relying Party ID | `construction-pm-mvp.vercel.app` |
| Origins | `https://construction-pm-mvp.vercel.app` |

RP ID を後から変えると、登録済みパスキーは全部使えなくなる。

制約:

- オリジンのホストは RP ID と一致する必要がある。Capacitor の `https://localhost` は本番 RP とパスキーを共有できない。アプリ内では Google / Apple / マジックリンクへ戻す。
- パスキー登録はログイン済みユーザーだけ（アカウント設定の「パスキーを登録」）。
- ローカルの `localhost` で試すには、別途 RP ID を `localhost` にしたプロジェクトが要る。本番プロジェクトの RP ではローカル発行は失敗する。

`supabase-js` 2.117 ではパスキー API は既定で有効。古いメモにある `auth.experimental.passkey` は不要。

## アカウント連携

Supabase → Authentication → Providers（または Settings）で **Manual linking** を有効にする。同じ確認済みメールの自動連携を使う場合は、そのトグルもオンにする。

アカウント設定から `linkIdentity` / `unlinkIdentity` を呼ぶ。最後の 1 つは外せない（Supabase の制約）。

## 手動確認

自動テストは秘密情報なし。次は Dashboard 投入後に人の手で行う。

1. Google（[auth-google.md](./auth-google.md)）が本番で `/app` に戻ること。
2. Apple で同じ戻り。名前の共有を拒否してもメールだけでセッションができること。
3. マジックリンクの URL と、6 桁コードの両方で入れること。Android ではコードで WebView にセッションが残ること。
4. 本番サイトの Chrome でパスキー登録と再ログイン。Android アプリ内ではフォールバック文言になること。
5. メールログインのあと、設定画面で Google と Apple を足せること。
