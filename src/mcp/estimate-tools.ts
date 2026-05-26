import { EstimateRepository, type EstimateRecord } from "../lib/supabase-adapter/EstimateRepository.js";
import { parseNaturalLanguage } from "../estimate/nl-estimate-parser.js";

export type EstimateItemInput = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category?: string;
};

export type EstimateWithItems = EstimateRecord & {
  items: EstimateItemInput[];
  notes?: string;
};

const estimateRepository = new EstimateRepository();
const estimateItems = new Map<string, { items: EstimateItemInput[]; notes?: string }>();

function newEstimateId(): string {
  return `estimate-${crypto.randomUUID()}`;
}

function totalAmount(items: EstimateItemInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

function withItems(record: EstimateRecord): EstimateWithItems {
  const detail = estimateItems.get(record.id);
  return {
    ...record,
    items: detail?.items ?? [],
    ...(detail?.notes ? { notes: detail.notes } : {}),
  };
}

export async function createEstimate(input: {
  project_id: string;
  items: EstimateItemInput[];
  notes?: string;
}): Promise<EstimateWithItems> {
  const now = new Date().toISOString();
  const estimate: EstimateRecord = {
    id: newEstimateId(),
    projectId: input.project_id,
    propertyName: input.project_id,
    clientName: "",
    totalAmount: totalAmount(input.items),
    taxRate: 0.1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await estimateRepository.saveAsync(estimate);
  estimateItems.set(estimate.id, {
    items: input.items.map((item) => ({ ...item })),
    ...(input.notes ? { notes: input.notes } : {}),
  });

  return withItems(estimate);
}

export async function listEstimates(projectId?: string): Promise<EstimateWithItems[]> {
  const records = projectId
    ? await estimateRepository.listByProjectAsync(projectId)
    : await estimateRepository.listAsync();
  return records.map(withItems);
}

export async function getEstimate(id: string): Promise<EstimateWithItems | null> {
  const estimate = await estimateRepository.getAsync(id);
  return estimate ? withItems(estimate) : null;
}

export function parseEstimateNl(text: string) {
  return parseNaturalLanguage(text);
}
