# QR入場×写真2枚ワークフロー Phase 1 仕様（2026-07-04 bd: construction_pm_mvp-agx）

## ゴール
現場QR→ログイン不要ページ(/#/entry/{projectId})→「開始写真1枚で入場記録、完了写真1枚で退場記録+工程進捗自動更新」が動くフロントエンド+repository+マイグレーションファイルを完成させる。

## 設計原則（光輝さん6/11メモ）
1. 必須写真は開始/完了の2枚だけ。途中写真は任意で何枚でも
2. QRページは業種で絞る: 職人は自分の業種の工程だけ見える
3. 判断に迷ったらシンプル優先（V2-Cozy）。頼まれていない機能を足さない

## 完成条件（機械検証可能）
- `npm run build` 成功
- `npx vitest run` 全緑（既存7,916+新規テスト）
- 新規/変更ロジックにユニットテストあり（SiteEntryRepository拡張・QR生成・進捗更新ロジック）

## 作業項目

### A. 本物のQRコード生成
- `qrcode` npm パッケージは**インストール済み**（package.json反映済み、importして使ってよい）
- `src/lib/site-entry-qr.ts` の偽SVGプレースホルダーを `qrcode` の `toString(url, {type:'svg'})` による本物のQRに置換
- URL形式は現行踏襲: `{baseUrl}/#/entry/{projectId}`
- `generateSiteEntryPrintHtml()`（A4印刷）は本物QR SVGを埋め込むよう更新
- 既存の呼び出し側（ProjectDetailPage）のシグネチャは変えない（async化が必要なら呼び出し側も追随）

### B. SiteEntryRecord 拡張
`src/lib/supabase-adapter/SiteEntryRepository.ts`:
- `SiteEntryRecord` に追加: `jobType?: string`, `startPhotoId?: string`, `endPhotoId?: string`, `taskId?: string`
- row変換 (`job_type`, `start_photo_id`, `end_photo_id`, `task_id`) 対応
- インメモリ経路も同様に動くこと

### C. マイグレーションファイル（**作成のみ・適用禁止**）
`supabase/migrations/draft_2026_07_04_site_entry_photos.sql`:
- `site_entry_records` に `job_type text`, `start_photo_id uuid`, `end_photo_id uuid`, `task_id uuid` を追加（ALTER TABLE ... ADD COLUMN IF NOT EXISTS）
- anon 書き込み用RLSポリシー案をコメント付きで記述:
  - anon INSERT: project_id が存在する projects を参照するもののみ
  - anon UPDATE: 同日レコードの exit_time / end_photo_id / 任意写真追記のみ
  - anon SELECT: 当日分のみ
  - コメントで「セキュリティ判断待ち: per-project entry_token 方式に強化する選択肢」を明記
- photos テーブル・storage への anon ポリシー案も同ファイルにコメントとして併記

### D. SiteEntryPage ワークフロー改修
`src/pages/SiteEntryPage.tsx`:
1. **入場フロー**: 名前+会社（既存のlocalStorage履歴活用）+ 業種選択（既存JOB_TYPES）→ **開始写真1枚必須**（カメラ起動 `<input type="file" accept="image/*" capture="environment">`）→ 入場記録保存
2. **業種ビュー**: 入場後、選択業種に対応する工程タスクだけを表示（TaskRepository から project のタスクを取得し、タスク名/担当が業種にマッチするものをフィルタ。マッチロジックは `PhotoProgressPanel.tsx` の TAG_TO_TRADE / inferTrade を流用・共通化してよい）。自分の作業対象タスクを1つ選択できる（任意）
3. **途中写真**: 任意で何枚でも追加できるボタン（アップロードは photos テーブルへ、category='progress'）
4. **退場フロー**: **完了写真1枚必須** → exit_time 記録 + 選択タスクがあれば status を更新（開始時: 'todo'|'planned'→'in_progress'、完了時: progress を100にせず **職長確認待ちを示す progress=90 とかはしない。シンプルに status='in_progress' のまま + 完了写真が紐づく**。タスクをdoneにするのは職長の判断なので自動doneはしない）
5. **写真アップロード**: 既存 `PhotoRepository.uploadPhoto()` を使用。anon認証で失敗する環境では**エラーで壊さず**「写真はローカル保持→オンライン化/認証後に送信予定」のフォールバック表示（IndexedDBは使わない。単純にアップ失敗時はレコード保存は続行し、写真未添付フラグをUIに表示）
6. 既存の当日入退場一覧表示は維持

### E. テスト
- SiteEntryRepository: 新フィールドのrow往復テスト
- site-entry-qr: 生成SVGに本物のQRモジュール（`<path`等）が含まれることのテスト
- SiteEntryPage: 開始写真なしで入場ボタンが無効/エラーになること、業種フィルタが効くことのcomponent test（既存テストのパターンに合わせる）

## 触ってはいけない境界
- **git commit / push 禁止**（検証後に司令塔がやる）
- **supabase migration の本番適用禁止**（ファイル作成のみ）
- 本番デーモン・他ページの無関係なリファクタ禁止
- `/ai-secretary` 等 laporta-hp には触らない（別リポジトリ）
- npm install は不要（qrcode導入済み）。他の新規依存追加は禁止

## 報告形式
完成条件に対する結果+証拠（build/vitest の実行結果末尾、変更ファイル一覧）
