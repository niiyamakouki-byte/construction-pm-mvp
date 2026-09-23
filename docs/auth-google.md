# Google ログイン（先に出荷する経路）

LapoSite（`construction-pm-mvp` / appId `jp.co.laporta.genbahub`）のログインは、既存の Supabase Auth の Google プロバイダだけを使う。別の認証サーバーは置かない。

この文書の設定を終えるまで、本番の Google ログインは完了しない。秘密情報はリポジトリに置かない。

## コードが保証していること

- デスクトップと本番 Web の戻り先は、今開いているオリジンのルート（ハッシュなし）。本番では `https://construction-pm-mvp.vercel.app/`。
- PKCE（`flowType: "pkce"`）、セッション永続化、自動更新、URL 上の `code` 検出を有効にしている。
- Capacitor Android（`androidScheme: "https"`）では WebView 内で Google を開かない。戻り先は `jp.co.laporta.genbahub://auth/callback`。`@capacitor/browser` があればシステムブラウザで開く。
- 認可コードは `exchangeCodeForSession` で、アプリの WebView セッションに交換する。
- ログインボタンはカレンダー読み取りスコープも同時に要求する（工程表の予定ダブり表示）。
- 失敗理由は日本語でログイン画面に出す。`access_denied` などはハッシュ遷移の前に退避する。
- カレンダー再連携のあとだけ `/account`（または元の画面）へ戻す。通常ログインは `/app`。
- Android WebView では「ログイン状態を保持」を外してもセッションは `localStorage` に残す。デスクトップはチェックボックスに従う。

## オーナーが Dashboard で入れる値

### 1. Supabase → Authentication → URL Configuration

- Site URL: `https://construction-pm-mvp.vercel.app`
- Redirect URLs に次を追加する（ワイルドカードはそのまま）:

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

`https://localhost` は Capacitor の WebView オリジン。Google の戻り先そのものではない。カスタムスキームが許可リストに無いと、Android から戻った瞬間に Supabase が拒否する。

### 2. Supabase → Authentication → Providers → Google

- Enable Google をオン
- Client ID と Client Secret は Google Cloud Console の OAuth クライアントからコピーする（このリポジトリには書かない）
- フロントの環境変数は既存のまま:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### 3. Google Cloud Console

- OAuth クライアントの承認済みリダイレクト URI は Supabase のものだけ:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

アプリの Vercel URL はここには入れない。入れるのは Supabase 側の Redirect URLs。

- 同意画面のスコープに、ログインが同時に要求するものを入れる:

```
openid
email
profile
https://www.googleapis.com/auth/calendar.readonly
```

`calendar.readonly` は機密スコープになり得る。未検証の同意画面だと、テストユーザー以外はログイン自体が止まる。検証が終わるまでは Google Cloud のテストユーザーに自分の Gmail を追加する。

### 4. Android（Capacitor）を実機で通すとき

Web 本番は上の設定だけで戻れる。実機アプリは追加で次が要る。

```bash
pnpm add @capacitor/core @capacitor/app @capacitor/browser
pnpm add -D @capacitor/cli @capacitor/android
pnpm run build
npx cap add android
npx cap sync android
```

`android/app/src/main/AndroidManifest.xml` の `<activity>` 内:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="jp.co.laporta.genbahub"
    android:host="auth"
    android:pathPrefix="/callback" />
</intent-filter>
```

プラグインが無いビルドでは、コードは認可 URL へ `location` で移る。その場合 Google が WebView を拒否する（`disallowed_useragent`）。実機確認はプラグイン導入後。

## 手動確認（ライブ OAuth）

自動テストは秘密情報なしで、リクエスト内容・戻り先・コード交換・日本語エラーまでを見る。次はオーナーのプロジェクトで一度だけ行う。

1. 本番 `https://construction-pm-mvp.vercel.app/#/login` で「Google でログイン」を押す。
2. Google の同意後、`/?code=` を経由して `/#/app` に着き、再読み込みしてもログインが残る。
3. 同意をキャンセルすると、ログイン画面に「ログインをキャンセルしました。」と出る。
4. アカウント設定の「Googleカレンダーを連携」から戻り、設定画面に戻る。
5. Android 実機で Custom Tab が開き、`jp.co.laporta.genbahub://auth/callback` でアプリに戻る。

## 同じ変更に入っている後続

Apple、マジックリンク、パスキーのコードと Dashboard 手順は [auth-providers.md](./auth-providers.md)。本番で先に通して報告するのは、この Google 経路。
