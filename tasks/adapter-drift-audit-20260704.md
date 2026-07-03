# Supabase Adapter スキーマ乖離監査 2026-07-04

> 正とするスキーマ: `tasks/prod-schema-dump-20260704.md`
> 対象: `src/lib/supabase-adapter/*.ts` (テストファイル除く、26ファイル)
> supabaseクライアントのimport元: `import { SupabaseRepository } from '../repository/supabase-repository.js'`
> (PhaseRepository/PhaseCascadeRepository は追加で `supabase-client.js` から直接クライアントも import)

---

## 全リポジトリ監査表

| # | リポジトリ名 | 対象テーブル | 判定 | 備考 |
|---|---|---|---|---|
| 1 | **ProjectRepository** | `projects` | ✅ | DB列: id,name,description,status,start_date,end_date,created_at,updated_at,address,budget,latitude,longitude,organization_id,include_weekends,mode — コードが使う列はすべて存在。`latitude`/`longitude`/`organization_id` はコードが送らないが nullable のため問題なし。 |
| 2 | **TaskRepository** | `tasks` | 🟡 | `isMilestone`フィールドがDB列に存在しない（コードコメント済み・固定`false`でフォールバック）。それ以外の列は一致。 |
| 3 | **ChatRepository** | `chat_messages` | 🔴 | コードのRow型は`{id,project_id,sender,content,created_at}`の5列。DB実体は`{id,project_id,organization_id,room_id,sender_id,sender_name,body,message_type,created_at,updated_at}`。具体的乖離: `sender`→DB実体なし/`content`→`body`/`created_at`書き込みはNG(auto)/`sender_id`・`sender_name`・`room_id`・`message_type`が未送信。INSERT時に`sender`列・`content`列を送ると400エラー。 |
| 4 | **SiteEntryRepository** | `site_entry_records` | 🔴 | コードRow型: `{id,project_id,worker_name,company,entry_time,exit_time,job_type,start_photo_id,end_photo_id,task_id}`。DB実体: `{id,project_id,organization_id,worker_name,company_name,entry_at,exit_at,entry_type,notes,created_at,updated_at}`。具体的乖離: `company`→`company_name` / `entry_time`→`entry_at` / `exit_time`→`exit_at` / `job_type`→`entry_type`(意味も異なる可能性あり) / `start_photo_id`,`end_photo_id`,`task_id`はDB列に存在しない。INSERT/UPDATEは全件エラー。 |
| 5 | **EstimateRepository** | `estimates`（部分）| 🟡 | コードが意図的にSupabase接続をスキップ(InMemoryフォールバック固定)。コメントに「粒度不一致: DB=明細行, コード=見積書単位」と明記。VITE_USE_SUPABASE=trueでも実害なし(接続しない)が、見積データは永続化されない。 |
| 6 | **InvoiceRepository** | `invoices` | 🔴 | コードRow型: `{id,project_id,amount,issued_date,paid_date,status}`。DB実体: `{id,project_id,organization_id,invoice_number,customer_id,status,issue_date,due_date,subtotal,tax_amount,total_amount,notes,created_at,updated_at}`。具体的乖離: `amount`→DB列なし(DBは`subtotal`/`tax_amount`/`total_amount`の3列) / `issued_date`→`issue_date` / `paid_date`→DB列なし / NOT NULL想定の`invoice_number`・`customer_id`が未送信。INSERT時に必須列欠損で400エラー確実。 |
| 7 | **ContractorRepository** | `contractors` | ✅ | DB列: id,name,contact_person,phone,email,line_id,specialty,created_at,updated_at — コードRow型の全列が一致。`trade`→`specialty`マッピングはコード内で明示済みで正しい。 |
| 8 | **CRMRepository (customers)** | `customers` | 🟡 | DB列: id,project_id,organization_id,name,company,email,phone,address,notes,status,created_at,updated_at。コードRow型に`project_id`が存在しない（INSERT時に`project_id`が欠落するがNULLABLEなら通過する可能性あり・要確認）。DB列`status`も未送信。また`note`(コード)→`notes`(DB)の単複不一致(READ時に`undefined`になる)。deals は InMemoryフォールバック固定。 |
| 8b | **CRMRepository (deals)** | `deals` | 🟡 | InMemoryフォールバック固定（コメントあり）。DB列: id,project_id,organization_id,customer_id,title,amount,stage,expected_close,notes,created_at,updated_at。コードのDealRecord.`estimatedAmount`/`actualAmount`/`probability`/`projectName`はDB列名と乖離。 |
| 9 | **SafetyRepository (ky_activities)** | `ky_activities` | 🟡 | DB列: id,project_id,organization_id,activity_date,leader_name,hazards,countermeasures,target_zero,participants,created_at,updated_at。コードRow型に`project_id`がない（INSERT時に欠落）。`date`→`activity_date` / `leader_name`・`target_zero`が未送信。organization_idはnull送信で通過の可能性あり（要確認）。 |
| 9b | **SafetyRepository (near_miss_reports)** | `near_miss_reports` | 🟡 | DB列: id,project_id,organization_id,occurred_at,location,description,cause,countermeasure,severity,reporter_name,created_at,updated_at。コードRow型に`project_id`なし / `datetime`→`occurred_at` / `cause_analysis`→`cause` / `reporter_name`未送信。INSERT時に列名不一致で400エラー。 |
| 10 | **PunchListRepository** | `punch_list_items` / `punch_list_history` | 🔴 | テーブル`punch_list_items`・`punch_list_history`はDBスキーマダンプに存在しない。コードが想定する全列の対応テーブルが本番にない。 |
| 11 | **PhotoRepository** | `photos` | 🟡 | Supabase接続を一切しない（インメモリのみ実装）。コードにSupabaseRepository importなし。写真データは永続化不可だが壊れはしない。DBの`photos`テーブルは存在するが未接続。 |
| 12 | **OrderRepository** | `purchase_orders` | ✅ | DB列: id,project_id,organization_id,supplier_name,order_number,status,order_date,expected_date,total_amount,notes,created_at,updated_at,contractor_id,contractor_name,items,tax_amount,total_with_tax,delivery_date。コードRow型の全主要列はDBに存在。`delivery_date`↔`expected_date`のフォールバックも実装済み。概ね一致。 |
| 13 | **MoodBoardRepository** | `mood_boards` | ✅ | DB列: id,project_id,organization_id,title,description,items,created_at,updated_at。コードRow型の全列がDB列のサブセット。`items`(jsonb)マッピングも一致。 |
| 14 | **SelectionRepository** | `selection_items` | 🟡 | DB列: id,project_id,organization_id,category,item_name,description,options,selected_option,deadline,status,notes,created_at,updated_at。コードRow型のstatusは英語enum('pending'/'decided'/'ordered'/'installed')で送信 — DBのstatus列の実際の型制約が不明だが列は存在。`item_name`↔`name`マッピング済み。`description`未送信(nullable想定)。概ね一致。 |
| 15 | **ProcurementRepository** | `procurement_materials` | ✅ | DB列: id,project_id,organization_id,name,category,quantity,unit,status,due_date,created_at,updated_at。コードRow型の全列がDBに存在。statusのenum値('unordered'/'ordered'/'delivered'/'accepted')はDB制約不明だが列は存在。 |
| 16 | **ClaimRepository** | `insurance_claims` / `claim_documents` / `claim_disputes` | 🔴 | 3テーブルすべてDBスキーマダンプに存在しない。 |
| 17 | **ComplianceRepository** | `compliance_requirements` / `compliance_audit_log` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 18 | **PermitRepository** | `permit_applications` / `permit_inspections` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 19 | **LaborRepository** | `labor_time_entries` / `crew_assignments` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 20 | **MeetingRepository** | `meeting_minutes` / `meeting_action_items` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 21 | **EquipmentRepository** | `equipment_rentals` / `equipment_usage_logs` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 22 | **WarrantyRepository** | `warranty_items` / `warranty_claims` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。 |
| 23 | **PhaseRepository** | `phases` / `phase_status_history` | 🔴 | 2テーブルともDBスキーマダンプに存在しない。(注: PhaseRepositoryはsupabase-client.jsを直接importし、SupabaseRepositoryラッパー経由に加え`supabase.from('phases').update(...)`を直呼びする実装あり) |
| 24 | **PhaseCascadeRepository** | `phases`（PhaseRepository経由） | 🔴 | PhaseRepositoryに依存。phases/phase_status_historyがDB未存在のため同様に🔴。`supabase.from('phases').update(...)`を直接呼ぶ。 |
| 25 | **CostMasterRepository** | なし（インメモリのみ） | 🟡 | Supabase接続を一切しない実装。対応するDBテーブルが存在しない（resourcesテーブルが近いが別用途）。壊れはしないが永続化不可。 |
| 26 | **RoomRepository** | なし（インメモリのみ） | 🟡 | Supabase接続を一切しない実装。対応するDBテーブルが存在しない。壊れはしないが永続化不可。 |

---

## 集計

| 判定 | 件数 | リポジトリ |
|---|---|---|
| ✅ 一致 | 5 | Project / Contractor / Order / MoodBoard / Procurement |
| 🟡 部分乖離 | 9 | Task, Estimate(意図的skip), CRM(customers+deals), Safety(ky+nm), Photo(未接続), Selection, CostMaster(未接続), Room(未接続) |
| 🔴 テーブル未存在またはカラム不一致で即壊れ | 12 | Chat, SiteEntry, Invoice, PunchList, Claim, Compliance, Permit, Labor, Meeting, Equipment, Warranty, Phase(+Cascade) |

※ PhaseCascadeはPhaseRepository依存なので🔴カウントはPhase+Cascadeで2件として集計

---

## 🟡 部分乖離の推奨修正詳細

### TaskRepository
- `isMilestone`フィールドはDB列なし。現在コードがコメントで認識済み・固定`false`。影響軽微。
- **推奨**: コード側で`isMilestone`を`Task`型から除去するか、DBに`ALTER TABLE tasks ADD COLUMN is_milestone boolean DEFAULT false`を追加。コード参照箇所が広いため要調査（コード側リネームよりDB追加が安全）。

### CRMRepository (customers)
- `note`(コード) → `notes`(DB): READで`undefined`になる。コード側を`notes`にリネーム要。
- `project_id`未送信: DB列の制約要確認。
- `status`未送信: DB列の制約要確認。
- **推奨**: CustomerRow型に`project_id?: string|null`, `status?: string|null`, `notes?`を追加し、マッピング修正（コード側変更のみで済む見込み）。

### SafetyRepository (ky_activities)
- `date`(コード) → `activity_date`(DB): INSERT/UPDATE時に`date`列送信=エラー。
- `project_id`未送信: DB列が存在する（NOT NULL制約要確認）。
- `leader_name`/`target_zero`未送信。
- **推奨**: KyActivityRowに`project_id`, `activity_date`(→`date`を廃止), `leader_name`, `target_zero`を追加。コード側修正のみ。

### SafetyRepository (near_miss_reports)
- `datetime`(コード) → `occurred_at`(DB): 列名不一致でINSERT失敗。
- `cause_analysis`(コード) → `cause`(DB): 列名不一致。
- `project_id`/`reporter_name`未送信。
- **推奨**: NearMissRowを`occurred_at`, `cause`, `project_id`, `reporter_name`を使うように修正。コード側のみ。

### SelectionRepository
- DB実際のstatus列の型制約が不明（'pending'/'decided'等を受け付けるか要確認）。
- 概ね動くが、DB制約次第でenum値エラーの可能性あり。

---

## 🔴 テーブル未存在の場合の推定CREATEスキーマ

### punch_list_items（PunchListRepository.tsのRow型から）
```sql
CREATE TABLE punch_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  title text NOT NULL,
  description text,
  location text,
  trade text,
  priority text, -- 'low'|'medium'|'high'|'critical'
  status text,   -- 'open'|'assigned'|'in_progress'|'resolved'|'verified'
  created_by text,
  due_date date,
  assigned_contractor_id uuid,
  assigned_contractor_name text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE punch_list_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES punch_list_items(id),
  action text, -- 'created'|'assigned'|'status_updated'|'resolved'|'verified'
  status text,
  actor text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### phases / phase_status_history（PhaseRepository.tsのRow型から）
```sql
CREATE TABLE phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  organization_id uuid,
  parent_id uuid REFERENCES phases(id),
  level int, -- 1|2|3
  name text NOT NULL,
  order_index int DEFAULT 0,
  start_date date,
  end_date date,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE phase_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES phases(id),
  old_status text,
  new_status text,
  changed_at timestamptz DEFAULT now(),
  changed_by text
);
```

（その他の未存在テーブル: insurance_claims, claim_documents, claim_disputes, compliance_requirements, compliance_audit_log, permit_applications, permit_inspections, labor_time_entries, crew_assignments, meeting_minutes, meeting_action_items, equipment_rentals, equipment_usage_logs, warranty_items, warranty_claims は各リポジトリのRow型から同様に起こせる。本監査では主要2件のみ例示。）

---

## VITE_USE_SUPABASE=true を本番投入した場合に即時に壊れる機能トップ5

### 1. チャット送受信（ChatRepository → chat_messages）【最高影響】
- INSERT時に`sender`列・`content`列を送るが、DB実体は`sender_id`/`sender_name`/`body`。
- 全チャットメッセージの書き込みが400エラーで失敗。既存の`chat_messages`テーブルの実データへの読み出しもマッピング失敗（`body`フィールドがコードの`content`に来ない）。
- **影響**: 全プロジェクトのチャット機能が書き込み・読み出し双方で即時破損。

### 2. 入退場記録（SiteEntryRepository → site_entry_records）【高影響】
- INSERT時に`company`/`entry_time`/`exit_time`を送るが、DBは`company_name`/`entry_at`/`exit_at`。
- 存在しない`start_photo_id`/`end_photo_id`/`task_id`列も送信。
- **影響**: 全入退場記録の新規登録が400エラー。既存レコードの読み出しも`company_name`が`undefined`になる。

### 3. 請求書操作（InvoiceRepository → invoices）【高影響】
- INSERT時に`amount`列を送るがDB列なし（`subtotal`/`tax_amount`/`total_amount`の3列が正）。NOT NULL想定の`invoice_number`・`customer_id`が未送信。
- `issued_date`→`issue_date`の列名不一致でREADも失敗。
- **影響**: 全請求書の新規作成・読み出しが即時エラー。

### 4. フェーズ管理・玉突き遅延（PhaseRepository/PhaseCascadeRepository）【高影響】
- `phases`テーブルがDB本番に存在しないため、フェーズ一覧取得・保存・ステータス変更・玉突き遅延適用のすべてがエラー。
- PhaseRepositoryはsupabase-client.jsで直接SQLを叩くため、テーブル未存在時に`relation "phases" does not exist`エラーがスロー。
- **影響**: 工程管理画面が全面的に使用不能。

### 5. 安全管理（SafetyRepository → ky_activities / near_miss_reports）【中〜高影響】
- KY活動: `date`列送信（DB列なし・正しくは`activity_date`）、`project_id`未送信。
- ヒヤリハット: `datetime`列送信（DB列なし・正しくは`occurred_at`）、`cause_analysis`→`cause`不一致。
- **影響**: KY活動・ヒヤリハット報告の全書き込みが400エラー。安全書類機能が機能停止。

---

*監査日: 2026-07-04 / 対象コミット: 現在のワーキングツリー*
