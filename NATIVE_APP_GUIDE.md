# GenbaHub ネイティブアプリ化ガイド（Capacitor）

## 概要

Capacitorを使ってGenbaHubをiOS/Androidネイティブアプリとしてビルドします。
既存のReact/Viteコードをそのまま流用し、WebViewでラップしてアプリ化します。

---

## 事前準備

### Apple Developer Program（iOS必須）
- 登録費用: **12,800円/年**
- 登録先: https://developer.apple.com/programs/
- App Store配布にはこのメンバーシップが必要（実機テストのみなら不要）
- Xcodeは無料でインストール可能

### Android（無料）
- Google Play Store配布は **$25（初回のみ）**
- Android Studio: https://developer.android.com/studio

### ツール要件
- Node.js 18以上
- Xcode 15以上（iOS）
- Android Studio（Android）
- JDK 17以上（Android）

---

## Capacitorインストール手順

```bash
# プロジェクトディレクトリで実行
cd ~/construction-pm-mvp

# Capacitorコアとブラウザプラグインをインストール
pnpm add @capacitor/core
pnpm add -D @capacitor/cli

# 初期化（capacitor.config.tsが既に存在するので --config-path を指定）
npx cap init --config-path capacitor.config.ts
```

---

## iOSプラットフォーム追加

```bash
pnpm add @capacitor/ios

# iOSプロジェクト生成（初回のみ）
npx cap add ios

# Webアプリをビルドしてネイティブプロジェクトに同期
pnpm run build
npx cap sync ios

# Xcodeで開く
npx cap open ios
```

Xcode上で「▶ Run」ボタンでシミュレータまたは実機で起動します。

---

## Androidプラットフォーム追加

```bash
pnpm add @capacitor/android

# Androidプロジェクト生成（初回のみ）
npx cap add android

# Webアプリをビルドしてネイティブプロジェクトに同期
pnpm run build
npx cap sync android

# Android Studioで開く
npx cap open android
```

Android Studio上で「▶ Run」ボタンでエミュレータまたは実機で起動します。

---

## 日常的な開発フロー

```bash
# 1. Webアプリを修正後、ビルド
pnpm run build

# 2. ネイティブプロジェクトに同期
npx cap sync

# 3. IDE確認（必要な場合）
npx cap open ios      # または android
```

---

## 便利なCapacitorプラグイン（任意）

| プラグイン | 用途 | インストール |
|-----------|------|------------|
| `@capacitor/camera` | カメラ（現場写真撮影） | `pnpm add @capacitor/camera` |
| `@capacitor/filesystem` | ファイル保存 | `pnpm add @capacitor/filesystem` |
| `@capacitor/push-notifications` | プッシュ通知 | `pnpm add @capacitor/push-notifications` |
| `@capacitor/geolocation` | 位置情報 | `pnpm add @capacitor/geolocation` |

---

## 注意点

- **サービスワーカー**: Capacitor WebView内では自動的に無効化済み（`index.html`で対応済み）
- **API通信**: Supabaseとの通信はHTTPS経由なので変更不要
- **ディープリンク**: Capacitorの `server.hostname` 設定でURLスキームを調整可能
- **App Store審査**: 初回申請は2〜7日かかる場合あり

---

## アプリ識別情報

```
App ID:   jp.co.laporta.genbahub
App Name: GenbaHub 現場管理
Web Dir:  dist
```
