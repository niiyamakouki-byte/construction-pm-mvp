-- Draft Migration: 本番未存在テーブルの CREATE IF NOT EXISTS
-- 作成のみ（適用禁止）。本番適用は司令塔が検証後に行う。
-- 各テーブルは supabase-adapter/ のRow型から起こした。
-- RLSポリシーは既存パターン「org members can manage ...」と同型。

-- ─────────────────────────────────────────────────────────────────────────────
-- punch_list_items / punch_list_history  (PunchListRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS punch_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  title text NOT NULL,
  description text,
  location text,
  trade text,
  priority text,    -- 'low'|'medium'|'high'|'critical'
  status text,      -- 'open'|'assigned'|'in_progress'|'resolved'|'verified'
  created_by text,
  due_date date,
  assigned_contractor_id uuid,
  assigned_contractor_name text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE punch_list_items ENABLE ROW LEVEL SECURITY;

-- org members can manage punch_list_items
CREATE POLICY "org members can manage punch_list_items"
  ON punch_list_items
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS punch_list_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES punch_list_items(id) ON DELETE CASCADE,
  organization_id uuid,
  action text,      -- 'created'|'assigned'|'status_updated'|'resolved'|'verified'
  status text,
  actor text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE punch_list_history ENABLE ROW LEVEL SECURITY;

-- org members can manage punch_list_history
CREATE POLICY "org members can manage punch_list_history"
  ON punch_list_history
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- insurance_claims / claim_documents / claim_disputes  (ClaimRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  claim_type text NOT NULL,
  incident_date date NOT NULL,
  description text,
  claimed_amount numeric(12,2) NOT NULL DEFAULT 0,
  approved_amount numeric(12,2),
  status text NOT NULL DEFAULT 'open',  -- 'open'|'under_review'|'approved'|'disputed'|'resolved'|'rejected'
  opened_by text,
  resolution_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage insurance_claims"
  ON insurance_claims
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES insurance_claims(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  file_name text NOT NULL,
  document_type text,   -- 'photo'|'invoice'|'report'|'correspondence'|'other'
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage claim_documents"
  ON claim_documents
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS claim_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES insurance_claims(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  reason text NOT NULL,
  disputed_amount numeric(12,2) NOT NULL DEFAULT 0,
  opened_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',  -- 'open'|'resolved'|'withdrawn'
  resolution_date date,
  outcome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE claim_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage claim_disputes"
  ON claim_disputes
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- compliance_requirements / compliance_audit_log  (ComplianceRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  name text NOT NULL,
  category text,
  description text,
  due_date date,
  status text,  -- 'compliant'|'warning'|'overdue'|'not_applicable'
  completed_date date,
  responsible_person text,
  document_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage compliance_requirements"
  ON compliance_requirements
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  organization_id uuid,
  action text NOT NULL,
  performed_by text,
  timestamp timestamptz DEFAULT now(),
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage compliance_audit_log"
  ON compliance_audit_log
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- permit_applications / permit_inspections  (PermitRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  permit_type text NOT NULL,
  jurisdiction text,
  application_date date NOT NULL,
  applicant_name text,
  status text NOT NULL DEFAULT 'applied',  -- 'applied'|'approved'|'inspection_scheduled'|'expired'|'closed'
  approval_date date,
  permit_number text,
  expiry_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE permit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage permit_applications"
  ON permit_applications
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS permit_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid REFERENCES permit_applications(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  inspection_type text NOT NULL,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',  -- 'scheduled'|'passed'|'failed'|'cancelled'
  inspector_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE permit_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage permit_inspections"
  ON permit_inspections
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- labor_time_entries / crew_assignments  (LaborRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS labor_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  worker_id text NOT NULL,
  worker_name text NOT NULL,
  trade text,
  hourly_rate numeric(10,2) DEFAULT 0,
  clock_in_time timestamptz NOT NULL,
  clock_out_time timestamptz,
  crew_id text,
  status text NOT NULL DEFAULT 'active',  -- 'active'|'completed'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE labor_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage labor_time_entries"
  ON labor_time_entries
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  crew_id text NOT NULL,
  crew_name text NOT NULL,
  worker_id text NOT NULL,
  worker_name text NOT NULL,
  assignment_date date NOT NULL,
  role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crew_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage crew_assignments"
  ON crew_assignments
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- meeting_minutes / meeting_action_items  (MeetingRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  meeting_date date NOT NULL,
  meeting_type text NOT NULL,
  facilitator text,
  location text,
  attendees jsonb DEFAULT '[]',
  discussion_points text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage meeting_minutes"
  ON meeting_minutes
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meeting_minutes(id) ON DELETE CASCADE,
  organization_id uuid,
  description text NOT NULL,
  owner text,
  due_date date,
  status text NOT NULL DEFAULT 'open',  -- 'open'|'in_progress'|'done'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage meeting_action_items"
  ON meeting_action_items
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- equipment_rentals / equipment_usage_logs  (EquipmentRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  daily_rate numeric(10,2) DEFAULT 0,
  rental_start_date date NOT NULL,
  expected_return_date date NOT NULL,
  actual_return_date date,
  vendor text,
  status text NOT NULL DEFAULT 'active',  -- 'active'|'returned'|'overdue'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage equipment_rentals"
  ON equipment_rentals
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS equipment_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES equipment_rentals(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  usage_date date NOT NULL,
  hours_used numeric(5,2) DEFAULT 0,
  available_hours numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage equipment_usage_logs"
  ON equipment_usage_logs
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- warranty_items / warranty_claims  (WarrantyRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warranty_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  asset_name text NOT NULL,
  category text,
  vendor_name text,
  start_date date NOT NULL,
  expiry_date date NOT NULL,
  warranty_terms text,
  serial_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE warranty_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage warranty_items"
  ON warranty_items
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_item_id uuid REFERENCES warranty_items(id) ON DELETE CASCADE,
  organization_id uuid,
  claim_date date NOT NULL,
  issue text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',  -- 'submitted'|'approved'|'denied'|'resolved'
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage warranty_claims"
  ON warranty_claims
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- phases / phase_status_history  (PhaseRepository.ts より)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid,
  parent_id uuid REFERENCES phases(id) ON DELETE SET NULL,
  level int NOT NULL DEFAULT 1,   -- 1=大項目, 2=中項目, 3=小項目
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planned',  -- 'planned'|'in_progress'|'blocked'|'done'|'canceled'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage phases"
  ON phases
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS phase_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES phases(id) ON DELETE CASCADE,
  organization_id uuid,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by text
);

ALTER TABLE phase_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage phase_status_history"
  ON phase_status_history
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
