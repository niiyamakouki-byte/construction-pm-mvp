# 案件登録3段モード設計

作成日: 2026-05-26
対象: GenbaHub / construction-pm-mvp

## 背景

工程表・予算・写真を前提にした案件登録は、過去案件、軽い修繕、工程表を作る予定のない現場に対して心理的に重い。登録されない案件が増えると、後から単価・職人・紹介経路・工事履歴を引けず、利用習慣も落ちる。

案件登録の入口を「ちゃんと管理するための作業」ではなく、「とりあえず記録を残す行為」に寄せる。

## 目的

- 過ぎた案件や小規模案件も登録対象にする。
- 工程表未作成でも案件一覧、検索、振り返り、AI提案の対象にする。
- 後から必要に応じて通常案件・完全案件へ昇格できる導線を作る。
- 既存の工程表・予算・写真・SiteEntry/Safety/Punch機能を壊さず段階導入する。

## 案件モード

### memo: メモ案件

最軽量の記録用モード。過去案件、完了済み案件、小規模修繕、工程表を作らない現場を受ける。

必須:
- 案件名

任意:
- 住所
- 契約日
- ステータス
- メモ
- 写真
- 金額
- 顧客名

初期値:
- `mode = "memo"`
- `status = "completed"` は自然文に「完工」「終わった」「済み」が含まれる場合だけ推定
- それ以外は `status = "planning"` または既存UIの選択値
- `includeWeekends = true`

### normal: 通常案件

現行の中心モード。工程表・予算・現場写真を使って進行管理する。

推奨入力:
- 案件名
- 住所
- 工程表またはテンプレ
- 予算または契約金額
- 現場写真

使う機能:
- Gantt / ScheduleFromEstimate
- CostManagement
- PhotoInspection
- DailyReport
- ProjectHealth

### full: 完全案件

SiteEntry / Safety / Compliance / Punch などを含む統合管理モード。

推奨入力:
- normal の入力一式
- 入退場、安全、検査、是正、引渡し関連の設定

使う機能:
- SiteEntry
- SafetyInspection
- FinishInspection / Punch
- Compliance系Repository
- 通知・顧客共有

## データ設計

### Domain

`src/domain/schemas.ts` に `ProjectModeSchema` を追加する。

```ts
export const ProjectModeSchema = z.enum(["memo", "normal", "full"]);

export const ProjectSchema = BaseEntitySchema.extend({
  mode: ProjectModeSchema.default("normal"),
  // existing fields...
});
```

型は `ProjectMode` をexportする。

```ts
export type ProjectMode = z.infer<typeof ProjectModeSchema>;
```

既存データ互換のため、読み取り時に `mode` がない案件は `normal` として扱う。メモ案件を新規追加する入口だけ `memo` を明示する。

### Database

Supabase migrationを追加する。

```sql
alter table public.projects
  add column if not exists mode text not null default 'normal'
  check (mode in ('memo', 'normal', 'full'));

create index if not exists projects_mode_idx on public.projects (mode);
```

`db/schema.sql` の `public.projects` にも同じ `mode` カラムを反映する。

### Repository

既存 `createProjectRepository` は `ProjectSchema` でread validationしているため、mode追加時はmapper層のcamel/snake変換を確認する。

確認対象:
- `src/infra/supabase-repository.ts`
- `src/api/supabase-store.ts`
- `src/lib/supabase-adapter/ProjectRepository.ts`
- `src/stores/project-store.ts`

## UX設計

### 案件作成入口

最初にモードを選ばせすぎない。デフォルトは「メモ案件」で、必要項目を足すと通常案件へ自然に進める。

推奨UI:
- 作成ボタン: 「案件をメモする」
- セグメント: `メモ` / `通常` / `完全`
- メモ案件のフォームは1画面で完結
- 通常・完全は既存フォーム項目を段階表示

メモ案件フォーム:
- 案件名
- 住所
- 契約日
- メモ
- ステータス

`住所` と `契約日` は任意表示にし、未入力でも保存できる。

### 案件一覧

一覧でmodeを見分けられるようにする。

- memo: 「メモ」
- normal: 「通常」
- full: 「完全」

メモ案件は不足情報を責めない表示にする。例: 「住所未入力」ではなく「住所を足すと地図に出せます」。

### 詳細画面

メモ案件では工程表タブを空エラーにしない。

表示優先:
- メモ
- 住所
- 契約日
- 写真
- 関連するチャット・日報

CTA:
- 「通常案件にする」
- 「工程表を作る」
- 「写真を追加」

### 次にやることペイン

AI提案は不足の指摘ではなく、資産化の提案にする。

例:
- 「メモ案件3件に住所を足すと、地図で振り返れます」
- 「完工メモから単価メモを作れます」
- 「写真があるメモ案件を通常案件へ昇格できます」

## 自然文登録

LINE/Discordから1メッセージでメモ案件を作る。

入力例:
- `白金台 中川邸 完工`
- `南青山 店舗補修 5/20 契約`
- `目黒 A様 クロス張替え 写真だけ`

初期parser方針:
- 案件名は全文から日付・状態語を除いた残り
- `完工` / `完了` / `済み` は `status = "completed"`
- `契約` に近い日付は `contractDate`
- 住所らしい地名は `address` 候補に入れるが、確信が低ければメモへ残す
- 迷ったら保存を優先し、後からAI提案で補完する

外部送信ではなく内部登録のため、既存のDiscord/LINE受信基盤に接続する場合も第三者送信は発生しない。ただしLINE公式アカウントの返信文や顧客向け通知を出す場合は別途承認対象。

## モード昇格

昇格は非破壊にする。`mode` を変えても既存メモ、写真、契約日、住所は保持する。

許可する遷移:
- `memo -> normal`
- `normal -> full`
- `memo -> full`

原則として降格も可能だが、full機能で作った安全・検査データは削除しない。UI上の主導線だけ軽くする。

## 実装ステップ

1. `ProjectModeSchema` とDB migrationを追加
2. Supabase mapperの `mode` 読み書き対応を確認・補正
3. 案件作成UIに `memo` デフォルトの軽量フォームを追加
4. 案件一覧・詳細でmode表示とメモ案件向け空状態を追加
5. 次にやることペインにメモ案件補完提案を追加
6. Discord/LINE自然文から `memo` 案件を作る内部APIを追加

## 受け入れ条件

- 案件名だけでメモ案件を保存できる。
- 既存案件はmigration後も `normal` として扱われる。
- メモ案件では工程表未作成でもエラー扱いにならない。
- メモ案件を通常案件に昇格して工程表を追加できる。
- 案件一覧で `memo` / `normal` / `full` を見分けられる。
- 自然文 `白金台 中川邸 完工` から `mode = "memo"` の完了案件候補を作れる。

## 未決事項

- 契約日をメモ案件の推奨入力にするか、完全任意にするか。
- `status = completed` のメモ案件をダッシュボードの進行中件数から除外する条件。
- LINE公式アカウントで返信を返す場合の承認ルール。
- メモ案件の検索対象に写真OCR・チャット要約をいつ含めるか。
