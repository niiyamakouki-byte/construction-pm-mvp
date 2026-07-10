# 工程カードビュー統合 設計メモ（第1弾: 変換層のみ実装済み、本ページ統合は第2弾）

## 結論（1行）
データソースは1つ（本体の `Task[]`、`task-store.ts` 経由）。カードビューは既存タスクを
**表示専用の形に整えるビュー**として追加する。書き込みは既存の task-store 経路をそのまま使い、
カード変換層(`card-schedule-converter.ts`)を書き込みの二重経路にしない。

## データフロー
```
Supabase / in-memory (tasks テーブル)
        │  createTaskRepository()  ← GanttPageと全く同じ
        ▼
      Task[]  ← ★ここが唯一の正本
        │
        ├─ GanttChart (既存)        … 時間軸バー表示
        └─ tasksToCard() (新設)     … カード+接続線 表示
                │
                ▼
        CardBoardPage (第2弾で新規実装)
```

`card-schedule-converter.ts` の `tasksToCard(tasks, idMap, photoStore)` は本番運用では
`idMap` を恒等写像（`{ [task.id]: task.id }`）で渡せばよい。`idMap` を非恒等で使うのは
genbahub-schedule-v2-proto のような **外部の静的シードデータをプロジェクトに初回インポートする時**
（`cardToTasks` で `t1`,`t2`... の仮IDから本物のUUIDへ払い出す）だけで、日常のカード表示/編集では不要。

## 第2弾で新規に書くファイル（具体名）
- `src/pages/CardBoardPage.tsx` — 新規ページ。`GanttPage.tsx` のデータロード部分
  （`createTaskRepository`, `createProjectRepository`, `useOrganizationContext` の使い方）をそのまま踏襲する。
- `src/components/card-board/CardBoardChart.tsx` — カード配置＋接続線の描画。
  `GanttChart.tsx` は時間軸バー前提のレイアウトエンジンのため流用性が低く、
  自由配置キャンバス用に新規で書くのが早い（`Task.canvasX`/`canvasY` は既存フィールドをそのまま転用できる）。
- `src/App.tsx` — ルート追加。13行目付近の `GanttPage` の lazy import と、
  502行目付近 `route === "/cross-project-gantt"` のパターンに倣い、
  例 `route.match(/^\/project\/([^/]+)\/cards$/)` を追加する。

## 既存で流用できるもの（新規実装不要）
- 書き込み経路: `task-store.ts` の `createTaskRepository()`（create/update/delete）をそのまま使う。
  カードUIでの追加・接続変更もここを直接呼ぶ（`QuickAddForm`/`TaskEditModal` と同じ書き込み経路）。
- 依存関係の意味論: `dependencies` (predecessor id 配列) + `dependencyType` は既にTask本体のフィールド。
  カードの矢印線＝これをそのまま可視化するだけで、別の依存関係モデルを作る必要はない。
- 遅延伝播: 接続変更後の日程再計算は既存の `cascade-scheduler.ts` / `phase-cascade.ts` に委譲できる
  （カードビュー側で再実装しない）。

## 未解決・第2弾の課題
- **photoStore**: `Task`/`Photo` どちらにも「カードに紐づく写真をローカルdataURLで即時プレビュー」という
  対応フィールドが無い。既存 `Photo` エンティティ（`projectId`+`taskId`+`url`、Storage URLベース）に
  正式に乗せるなら、`CardPhotoRecord.photos[].dataUrl` → アップロード → `Photo.url` という変換が要る。
  現行の `card-schedule-converter.ts` はこの部分を素通し(pass-through)にしているだけで、
  Task化・Photo化は未実装（意図的なスコープ外、`ponytail:` コメント参照）。
- **qty表記の構造化**: 現状 `qty` は `Task.description` に文字列のまま入れている（"35㎡" 等）。
  見積連携（cost-master等）まで踏み込むなら、将来的に構造化フィールド（数量+単位）が要るが、
  第1弾では過剰設計を避けてdescription格納のままにしている。
