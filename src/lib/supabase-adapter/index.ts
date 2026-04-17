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
