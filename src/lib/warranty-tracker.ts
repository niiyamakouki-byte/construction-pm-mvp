import { escapeHtml } from "./utils/escape-html";
export type WarrantyClaimStatus =
  | "submitted"
  | "approved"
  | "denied"
  | "resolved";

export type WarrantyClaim = {
  id: string;
  claimDate: string;
  issue: string;
  status: WarrantyClaimStatus;
  resolutionNotes?: string;
};

export type WarrantyItem = {
  id: string;
  projectId: string;
  assetName: string;
  category: string;
  vendorName: string;
  startDate: string;
  expiryDate: string;
  warrantyTerms?: string;
  serialNumber?: string;
  claimHistory: WarrantyClaim[];
};

export type RegisterWarrantyItemInput = Omit<WarrantyItem, "id" | "claimHistory"> & {
  id?: string;
};

export type WarrantyClaimInput = Omit<WarrantyClaim, "id"> & {
  id?: string;
};

export type WarrantyExpiryAlert = {
  itemId: string;
  assetName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: "expiring" | "expired";
};

const warrantyItems: WarrantyItem[] = [];
let warrantyCounter = 1;
let claimCounter = 1;

function nextWarrantyId(): string {
  return `warranty-${warrantyCounter++}`;
}

function nextClaimId(): string {
  return `warranty-claim-${claimCounter++}`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function cloneWarrantyItem(item: WarrantyItem): WarrantyItem {
  return {
    ...item,
    claimHistory: item.claimHistory.map((claim) => ({ ...claim })),
  };
}


function diffDays(start: string, end: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / msPerDay,
  );
}

export function registerWarrantyItem(input: RegisterWarrantyItemInput): WarrantyItem {
  const item: WarrantyItem = {
    ...input,
    id: input.id ?? nextWarrantyId(),
    claimHistory: [],
  };

  warrantyItems.push(item);
  return cloneWarrantyItem(item);
}

export function getWarrantyItems(projectId?: string): WarrantyItem[] {
  const items = projectId
    ? warrantyItems.filter((item) => item.projectId === projectId)
    : warrantyItems;

  return items.map((item) => cloneWarrantyItem(item));
}

export function addWarrantyClaim(itemId: string, claim: WarrantyClaimInput): WarrantyItem {
  const itemIndex = warrantyItems.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) {
    throw new Error(`Warranty item not found: ${itemId}`);
  }

  const updated: WarrantyItem = {
    ...warrantyItems[itemIndex],
    claimHistory: [
      ...warrantyItems[itemIndex].claimHistory,
      {
        ...claim,
        id: claim.id ?? nextClaimId(),
      },
    ],
  };

  warrantyItems[itemIndex] = updated;
  return cloneWarrantyItem(updated);
}

export function getExpiryAlerts(
  referenceDate = getToday(),
  daysAhead = 30,
  projectId?: string,
): WarrantyExpiryAlert[] {
  return getWarrantyItems(projectId)
    .map((item) => {
      const daysUntilExpiry = diffDays(referenceDate, item.expiryDate);
      return {
        itemId: item.id,
        assetName: item.assetName,
        expiryDate: item.expiryDate,
        daysUntilExpiry,
        status: daysUntilExpiry < 0 ? "expired" : "expiring",
      } as WarrantyExpiryAlert;
    })
    .filter((alert) => alert.daysUntilExpiry <= daysAhead);
}

export function generateWarrantyReport(projectId: string, referenceDate = getToday()): string {
  const items = getWarrantyItems(projectId);
  const alerts = getExpiryAlerts(referenceDate, 30, projectId);

  const rows = items.length > 0
    ? items
        .map((item) => `<tr><td>${escapeHtml(item.assetName)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.vendorName)}</td><td>${escapeHtml(item.expiryDate)}</td><td>${item.claimHistory.length}</td></tr>`)
        .join("")
    : '<tr><td colspan="5">No warranty items registered.</td></tr>';

  const alertList = alerts.length > 0 ? alerts.map((alert) => `<li>${escapeHtml(alert.assetName)} - ${escapeHtml(alert.expiryDate)} (${alert.daysUntilExpiry} days)</li>`).join("") : "<li>No upcoming expiry alerts.</li>";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Warranty Report - ${escapeHtml(projectId)}</title></head><body><h1>Warranty Report</h1><p><strong>Project ID:</strong> ${escapeHtml(projectId)}</p><p><strong>Reference Date:</strong> ${escapeHtml(referenceDate)}</p><h2>Expiry Alerts</h2><ul>${alertList}</ul><h2>Registered Warranty Items</h2><table><thead><tr><th>Asset</th><th>Category</th><th>Vendor</th><th>Expiry Date</th><th>Claims</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function clearWarrantyItems(): void {
  warrantyItems.length = 0;
  warrantyCounter = 1;
  claimCounter = 1;
}
