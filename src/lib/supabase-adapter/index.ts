/**
 * supabase-adapter — Phase A エクスポート
 * 7 高優先度 Repository の async エイリアス版
 */

export { ProjectRepository } from './ProjectRepository.js';
export type { Project } from './ProjectRepository.js';

export { TaskRepository } from './TaskRepository.js';
export type { Task } from './TaskRepository.js';

export { EstimateRepository } from './EstimateRepository.js';
export type { EstimateRecord } from './EstimateRepository.js';

export { PhotoRepository } from './PhotoRepository.js';
export type { PhotoRecord } from './PhotoRepository.js';

export { RoomRepository } from './RoomRepository.js';
export type { RoomRecord } from './RoomRepository.js';

export { ContractorRepository } from './ContractorRepository.js';
export type { ContractorRecord } from './ContractorRepository.js';

export { CostMasterRepository } from './CostMasterRepository.js';
export type { CostMasterItem } from './CostMasterRepository.js';

export { ChatRepository } from './ChatRepository.js';
export type { ChatMessageRecord } from './ChatRepository.js';

export { CRMRepository } from './CRMRepository.js';
export type { CustomerRecord, DealRecord, DealStage } from './CRMRepository.js';

export { InvoiceRepository } from './InvoiceRepository.js';
export type { InvoiceRecord, InvoiceStatus, InvoiceItemRecord } from './InvoiceRepository.js';

export { MoodBoardRepository } from './MoodBoardRepository.js';
export type {
  MoodBoardRecord,
  MoodBoardItemRecord,
  MoodBoardCategory,
} from './MoodBoardRepository.js';

export { SelectionRepository } from './SelectionRepository.js';
export type {
  SelectionItemRecord,
  SelectionOptionRecord,
  SelectionCategory,
  SelectionStatus,
} from './SelectionRepository.js';

export { ProcurementRepository } from './ProcurementRepository.js';
export type {
  ProcurementMaterialRecord,
  ProcurementMaterialStatus,
} from './ProcurementRepository.js';

export { OrderRepository } from './OrderRepository.js';
export type {
  PurchaseOrderRecord,
  PurchaseOrderItemRecord,
  PurchaseOrderStatus,
} from './OrderRepository.js';

export { LaborRepository } from './LaborRepository.js';
export type {
  LaborTimeEntryRecord,
  CrewAssignmentRecord,
  LaborEntryStatus,
} from './LaborRepository.js';

export { SiteEntryRepository } from './SiteEntryRepository.js';
export type { SiteEntryRecord } from './SiteEntryRepository.js';

export { SafetyRepository } from './SafetyRepository.js';
export type {
  KyActivityRecord,
  NearMissReportRecord,
  NearMissSeverity,
} from './SafetyRepository.js';

export { PunchListRepository } from './PunchListRepository.js';
export type {
  PunchListItemRecord,
  PunchListHistoryRecord,
  PunchListPriority,
  PunchListStatus,
  PunchListHistoryAction,
} from './PunchListRepository.js';

export { EquipmentRepository } from './EquipmentRepository.js';
export type {
  EquipmentRentalRecord,
  EquipmentUsageLogRecord,
  EquipmentRentalStatus,
} from './EquipmentRepository.js';
