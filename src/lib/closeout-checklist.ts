/**
 * Project closeout checklist with required completion gates.
 */

export const CloseoutItemCategory = {
  finalInspection: "final_inspection",
  asBuiltDocs: "as_built_documents",
  warrantyHandover: "warranty_handover",
  clientSignOff: "client_sign_off",
} as const;

export type CloseoutItemCategory =
  (typeof CloseoutItemCategory)[keyof typeof CloseoutItemCategory];

export type CloseoutChecklistItem = {
  id: string;
  checklistId: string;
  projectId: string;
  category: CloseoutItemCategory;
  title: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
};

export type ProjectCloseoutChecklist = {
  id: string;
  projectId: string;
  createdAt: string;
  items: CloseoutChecklistItem[];
};

export type CloseoutProgress = {
  checklistId: string;
  totalItems: number;
  completedItems: number;
  requiredItems: number;
  requiredCompleted: number;
  percentage: number;
  readyForCloseout: boolean;
  missingRequiredItems: CloseoutChecklistItem[];
};

const checklists: ProjectCloseoutChecklist[] = [];

const DEFAULT_ITEMS: Array<
  Pick<CloseoutChecklistItem, "category" | "title" | "required">
> = [
  {
    category: CloseoutItemCategory.finalInspection,
    title: "Final inspection passed",
    required: true,
  },
  {
    category: CloseoutItemCategory.asBuiltDocs,
    title: "As-built documents delivered",
    required: true,
  },
  {
    category: CloseoutItemCategory.warrantyHandover,
    title: "Warranty handover completed",
    required: true,
  },
  {
    category: CloseoutItemCategory.clientSignOff,
    title: "Client sign-off received",
    required: true,
  },
];

export function createCloseoutChecklist(
  projectId: string,
  createdAt = new Date().toISOString(),
): ProjectCloseoutChecklist {
  const existing = checklists.find((checklist) => checklist.projectId === projectId);
  if (existing) {
    return existing;
  }

  const checklistId = `closeout-${projectId}`;
  const checklist: ProjectCloseoutChecklist = {
    id: checklistId,
    projectId,
    createdAt,
    items: DEFAULT_ITEMS.map((item, index) => ({
      id: `${checklistId}-${index + 1}`,
      checklistId,
      projectId,
      category: item.category,
      title: item.title,
      required: item.required,
      completed: false,
    })),
  };

  checklists.push(checklist);
  return checklist;
}

export function getCloseoutChecklist(
  projectId: string,
): ProjectCloseoutChecklist | null {
  return checklists.find((checklist) => checklist.projectId === projectId) ?? null;
}

export function completeCloseoutItem(
  projectId: string,
  category: CloseoutItemCategory,
  completedBy: string,
  completedAt: string,
  notes?: string,
): CloseoutChecklistItem | null {
  const checklist = getCloseoutChecklist(projectId);
  if (!checklist) return null;

  const item = checklist.items.find((entry) => entry.category === category);
  if (!item) return null;

  item.completed = true;
  item.completedBy = completedBy;
  item.completedAt = completedAt;
  item.notes = notes;
  return item;
}

export function getOutstandingCloseoutItems(
  projectId: string,
): CloseoutChecklistItem[] {
  const checklist = getCloseoutChecklist(projectId);
  if (!checklist) return [];

  return checklist.items.filter((item) => !item.completed);
}

export function getCloseoutProgress(projectId: string): CloseoutProgress | null {
  const checklist = getCloseoutChecklist(projectId);
  if (!checklist) return null;

  const completedItems = checklist.items.filter((item) => item.completed);
  const requiredItems = checklist.items.filter((item) => item.required);
  const missingRequiredItems = requiredItems.filter((item) => !item.completed);

  return {
    checklistId: checklist.id,
    totalItems: checklist.items.length,
    completedItems: completedItems.length,
    requiredItems: requiredItems.length,
    requiredCompleted: requiredItems.length - missingRequiredItems.length,
    percentage: Math.round((completedItems.length / checklist.items.length) * 100),
    readyForCloseout: missingRequiredItems.length === 0,
    missingRequiredItems,
  };
}

export function isProjectCloseoutComplete(projectId: string): boolean {
  return getCloseoutProgress(projectId)?.readyForCloseout ?? false;
}

export function _resetCloseoutStore(): void {
  checklists.length = 0;
}
