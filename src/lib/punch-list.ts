export type PunchListPriority = "low" | "medium" | "high" | "critical";

export type PunchListStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified";

export type PunchListHistoryEntry = {
  id: string;
  action: "created" | "assigned" | "status_updated" | "resolved" | "verified";
  status: PunchListStatus;
  actor: string;
  timestamp: string;
  notes?: string;
};

export type PunchListItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchListPriority;
  status: PunchListStatus;
  createdAt: string;
  createdBy: string;
  dueDate?: string;
  assignedContractorId?: string;
  assignedContractorName?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  history: PunchListHistoryEntry[];
};

export type CreatePunchListItemInput = Omit<
  PunchListItem,
  | "id"
  | "status"
  | "createdAt"
  | "history"
  | "resolvedAt"
  | "resolvedBy"
  | "resolutionNotes"
  | "verifiedAt"
  | "verifiedBy"
> & {
  id?: string;
  createdAt?: string;
  status?: Exclude<PunchListStatus, "resolved" | "verified">;
};

export type PunchListAssignment = {
  contractorId: string;
  contractorName: string;
  assignedBy: string;
  assignedAt?: string;
  notes?: string;
};

export type PunchListResolution = {
  resolvedBy: string;
  resolvedAt?: string;
  notes?: string;
};

export type PunchListVerification = {
  verifiedBy: string;
  verifiedAt?: string;
  notes?: string;
};

const punchListItems: PunchListItem[] = [];
let itemCounter = 1;
let historyCounter = 1;

function nextItemId(): string {
  const id = `punch-${itemCounter}`;
  itemCounter += 1;
  return id;
}

function nextHistoryId(): string {
  const id = `punch-history-${historyCounter}`;
  historyCounter += 1;
  return id;
}

function findPunchListItemIndex(itemId: string): number {
  return punchListItems.findIndex((item) => item.id === itemId);
}

function getNow(): string {
  return new Date().toISOString();
}

function cloneItem(item: PunchListItem): PunchListItem {
  return {
    ...item,
    history: item.history.map((entry) => ({ ...entry })),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createPunchListItem(input: CreatePunchListItemInput): PunchListItem {
  const createdAt = input.createdAt ?? getNow();
  const status = input.status ?? "open";
  const item: PunchListItem = {
    ...input,
    id: input.id ?? nextItemId(),
    createdAt,
    status,
    history: [
      {
        id: nextHistoryId(),
        action: "created",
        status,
        actor: input.createdBy,
        timestamp: createdAt,
        notes: "Punch list item created",
      },
    ],
  };

  punchListItems.push(item);
  return cloneItem(item);
}

export function getPunchListItems(projectId?: string): PunchListItem[] {
  const items = projectId
    ? punchListItems.filter((item) => item.projectId === projectId)
    : punchListItems;

  return items.map((item) => cloneItem(item));
}

export function assignPunchListItem(
  itemId: string,
  assignment: PunchListAssignment,
): PunchListItem {
  const itemIndex = findPunchListItemIndex(itemId);
  if (itemIndex < 0) {
    throw new Error(`Punch list item not found: ${itemId}`);
  }

  const assignedAt = assignment.assignedAt ?? getNow();
  const updated: PunchListItem = {
    ...punchListItems[itemIndex],
    assignedContractorId: assignment.contractorId,
    assignedContractorName: assignment.contractorName,
    status: "assigned",
    history: [
      ...punchListItems[itemIndex].history,
      {
        id: nextHistoryId(),
        action: "assigned",
        status: "assigned",
        actor: assignment.assignedBy,
        timestamp: assignedAt,
        notes: assignment.notes ?? `Assigned to ${assignment.contractorName}`,
      },
    ],
  };

  punchListItems[itemIndex] = updated;
  return cloneItem(updated);
}

export function updatePunchListItemStatus(
  itemId: string,
  status: Exclude<PunchListStatus, "resolved" | "verified">,
  actor: string,
  updatedAt = getNow(),
  notes?: string,
): PunchListItem {
  const itemIndex = findPunchListItemIndex(itemId);
  if (itemIndex < 0) {
    throw new Error(`Punch list item not found: ${itemId}`);
  }

  const updated: PunchListItem = {
    ...punchListItems[itemIndex],
    status,
    history: [
      ...punchListItems[itemIndex].history,
      {
        id: nextHistoryId(),
        action: "status_updated",
        status,
        actor,
        timestamp: updatedAt,
        notes,
      },
    ],
  };

  punchListItems[itemIndex] = updated;
  return cloneItem(updated);
}

export function resolvePunchListItem(
  itemId: string,
  resolution: PunchListResolution,
): PunchListItem {
  const itemIndex = findPunchListItemIndex(itemId);
  if (itemIndex < 0) {
    throw new Error(`Punch list item not found: ${itemId}`);
  }

  const resolvedAt = resolution.resolvedAt ?? getNow();
  const updated: PunchListItem = {
    ...punchListItems[itemIndex],
    status: "resolved",
    resolvedAt,
    resolvedBy: resolution.resolvedBy,
    resolutionNotes: resolution.notes,
    history: [
      ...punchListItems[itemIndex].history,
      {
        id: nextHistoryId(),
        action: "resolved",
        status: "resolved",
        actor: resolution.resolvedBy,
        timestamp: resolvedAt,
        notes: resolution.notes,
      },
    ],
  };

  punchListItems[itemIndex] = updated;
  return cloneItem(updated);
}

export function verifyPunchListItem(
  itemId: string,
  verification: PunchListVerification,
): PunchListItem {
  const itemIndex = findPunchListItemIndex(itemId);
  if (itemIndex < 0) {
    throw new Error(`Punch list item not found: ${itemId}`);
  }

  const verifiedAt = verification.verifiedAt ?? getNow();
  const updated: PunchListItem = {
    ...punchListItems[itemIndex],
    status: "verified",
    verifiedAt,
    verifiedBy: verification.verifiedBy,
    history: [
      ...punchListItems[itemIndex].history,
      {
        id: nextHistoryId(),
        action: "verified",
        status: "verified",
        actor: verification.verifiedBy,
        timestamp: verifiedAt,
        notes: verification.notes,
      },
    ],
  };

  punchListItems[itemIndex] = updated;
  return cloneItem(updated);
}

export function generatePunchListReport(projectId: string): string {
  const items = getPunchListItems(projectId).sort((a, b) => {
    if (a.priority === b.priority) {
      return a.createdAt.localeCompare(b.createdAt);
    }

    const priorityOrder: Record<PunchListPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const totals = {
    total: items.length,
    open: items.filter((item) => item.status === "open").length,
    assigned: items.filter((item) => item.status === "assigned").length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    resolved: items.filter((item) => item.status === "resolved").length,
    verified: items.filter((item) => item.status === "verified").length,
  };

  const rows = items.length > 0
    ? items
        .map(
          (item) => `<tr>
  <td>${escapeHtml(item.id)}</td>
  <td>${escapeHtml(item.title)}</td>
  <td>${escapeHtml(item.location)}</td>
  <td>${escapeHtml(item.trade)}</td>
  <td>${escapeHtml(item.priority)}</td>
  <td>${escapeHtml(item.status)}</td>
  <td>${escapeHtml(item.assignedContractorName ?? "Unassigned")}</td>
  <td>${escapeHtml(item.resolutionNotes ?? "")}</td>
</tr>`,
        )
        .join("\n")
    : '<tr><td colspan="8">No punch list items recorded.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Punch List Report - ${escapeHtml(projectId)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #111827; color: white; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .card { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; background: #f9fafb; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Punch List Report</h1>
  <p>Project ID: <strong>${escapeHtml(projectId)}</strong></p>
  <div class="summary">
    <div class="card">Total Items: ${totals.total}</div>
    <div class="card">Open / Assigned / In Progress: ${totals.open} / ${totals.assigned} / ${totals.inProgress}</div>
    <div class="card">Resolved / Verified: ${totals.resolved} / ${totals.verified}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Title</th>
        <th>Location</th>
        <th>Trade</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Assigned Contractor</th>
        <th>Resolution Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

export function clearPunchListItems(): void {
  punchListItems.length = 0;
  itemCounter = 1;
  historyCounter = 1;
}
