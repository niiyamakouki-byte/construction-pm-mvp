import type {
  ApiChangeOrderRecord,
  ApiContractorRecord,
  ApiMaterialRecord,
  ApiProjectRecord,
  ApiTaskRecord,
} from "./types.js";

export function serializeProject(project: ApiProjectRecord, taskCount?: number) {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    name: project.name,
    contractor: project.contractor,
    address: project.address,
    status: project.status,
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate ?? null,
    includeWeekends: project.includeWeekends,
    clientId: project.clientId ?? null,
    clientName: project.clientName ?? null,
    contractAmount: project.contractAmount ?? null,
    contractDate: project.contractDate ?? null,
    inspectionDate: project.inspectionDate ?? null,
    handoverDate: project.handoverDate ?? null,
    warrantyEndDate: project.warrantyEndDate ?? null,
    ...(taskCount !== undefined ? { taskCount } : {}),
  };
}

export function serializeTask(task: ApiTaskRecord) {
  return {
    id: task.id,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    projectId: task.projectId,
    name: task.name,
    description: task.description,
    status: task.status,
    startDate: task.startDate ?? null,
    endDate: task.dueDate ?? null,
    progress: task.progress,
    cost: task.cost,
    dependencies: task.dependencies,
    contractorId: task.contractorId ?? null,
    contractor: task.contractor ?? null,
    isMilestone: task.isMilestone,
  };
}

export function serializeContractor(contractor: ApiContractorRecord) {
  return {
    id: contractor.id,
    createdAt: contractor.createdAt,
    updatedAt: contractor.updatedAt,
    name: contractor.name,
    trade: contractor.trade,
    phone: contractor.phone,
    email: contractor.email,
  };
}

export function serializeMaterial(material: ApiMaterialRecord) {
  return {
    id: material.id,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    projectId: material.projectId,
    name: material.name,
    quantity: material.quantity,
    unit: material.unit,
    unitPrice: material.unitPrice,
    supplier: material.supplier,
    deliveryDate: material.deliveryDate,
    status: material.status,
    totalCost: material.quantity * material.unitPrice,
  };
}

export function serializeChangeOrder(changeOrder: ApiChangeOrderRecord) {
  return {
    id: changeOrder.id,
    createdAt: changeOrder.createdAt,
    updatedAt: changeOrder.updatedAt,
    projectId: changeOrder.projectId,
    description: changeOrder.description,
    amount: changeOrder.amount,
    approvedBy: changeOrder.approvedBy,
    date: changeOrder.date,
    status: changeOrder.status,
  };
}

export function calculateProjectProgress(tasks: ApiTaskRecord[]): number {
  if (tasks.length === 0) {
    return 0;
  }

  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
}

export function calculateCostSummary(
  tasks: ApiTaskRecord[],
  materials: ApiMaterialRecord[],
  changeOrders: ApiChangeOrderRecord[],
) {
  const taskCost = tasks.reduce((sum, task) => sum + task.cost, 0);
  const materialCost = materials.reduce(
    (sum, material) => sum + material.quantity * material.unitPrice,
    0,
  );
  const approvedChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "approved")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);
  const pendingChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "pending")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);
  const rejectedChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "rejected")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);

  return {
    taskCost,
    materialCost,
    approvedChangeOrderCost,
    pendingChangeOrderCost,
    rejectedChangeOrderCost,
    totalCost: taskCost + materialCost + approvedChangeOrderCost,
  };
}
