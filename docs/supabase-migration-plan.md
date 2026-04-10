# Supabase移行計画書

## 現状分析
- 既存マイグレーション(001-012)で基本テーブル(projects/tasks/contractors等)はカバー済み
- lib内に約20個のインメモリストアが散在 → リロードで消失
- 012でRLSが一時無効化されたまま
- contractors/notificationsテーブルがAPI版とdomain版で重複

## 未対応インメモリストア（Phase 2-3で移行）
1. chat-store (ChatRoom, ChatMessage)
2. crm-store (Customer, Deal)
3. order-management (PurchaseOrder, DeliveryCheck)
4. labor-tracker (LaborTimeEntry, CrewAssignment)
5. site-entry-log (SiteEntryRecord)
6. safety-records (KyActivity, NearMissReport)
7. punch-list (PunchListItem)
8. equipment-tracker (EquipmentRental)
9. compliance-tracker (ComplianceRequirement)
10. claim-manager (InsuranceClaim)
11. permit-tracker (PermitApplication)
12. meeting-minutes (MeetingMinutes)
13. warranty-tracker (WarrantyItem)

## 移行フェーズ
### Phase 1: RLS修正+テーブル統合（最優先）
### Phase 2: 優先7ストアのRepository移行（chat/crm/order/labor/site-entry/safety/punch-list）
### Phase 3: 残りストアのマイグレーション
### Phase 4: テスト整備

## 詳細は session_handoff.md + architect分析結果を参照
