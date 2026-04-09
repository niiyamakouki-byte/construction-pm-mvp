export type RFIStatus = "open" | "assigned" | "answered" | "closed";

export type RFIHistoryAction = "created" | "assigned" | "responded" | "closed";

export type RFIHistoryEntry = {
  id: string;
  action: RFIHistoryAction;
  actor: string;
  timestamp: string;
  notes?: string;
};

export type RFIResponse = {
  respondedBy: string;
  respondedAt: string;
  answer: string;
};

export type RFI = {
  id: string;
  projectId: string;
  subject: string;
  question: string;
  requestedBy: string;
  createdAt: string;
  dueDate?: string;
  status: RFIStatus;
  assignedTo?: string;
  response?: RFIResponse;
  history: RFIHistoryEntry[];
};

export type CreateRFIInput = Omit<
  RFI,
  "id" | "createdAt" | "status" | "response" | "history"
> & {
  id?: string;
  createdAt?: string;
  status?: Exclude<RFIStatus, "answered" | "closed">;
};

export type RFIAssignment = {
  assignee: string;
  assignedBy: string;
  assignedAt?: string;
  notes?: string;
};

export type RFIReply = {
  respondedBy: string;
  respondedAt?: string;
  answer: string;
};

export type RFILogEntry = {
  id: string;
  subject: string;
  status: RFIStatus;
  requestedBy: string;
  assignedTo?: string;
  dueDate?: string;
  responseHours: number | null;
  isOverdue: boolean;
};

const rfis: RFI[] = [];
let rfiCounter = 1;
let historyCounter = 1;

function nextRFIId(): string {
  const id = `rfi-${rfiCounter}`;
  rfiCounter += 1;
  return id;
}

function nextHistoryId(): string {
  const id = `rfi-history-${historyCounter}`;
  historyCounter += 1;
  return id;
}

function getNow(): string {
  return new Date().toISOString();
}

function cloneRFI(rfi: RFI): RFI {
  return {
    ...rfi,
    response: rfi.response ? { ...rfi.response } : undefined,
    history: rfi.history.map((entry) => ({ ...entry })),
  };
}

function findRFIIndex(rfiId: string): number {
  return rfis.findIndex((rfi) => rfi.id === rfiId);
}

function calculateHours(start: string, end: string): number {
  const msPerHour = 1000 * 60 * 60;
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / msPerHour;
  return Math.round(diff * 10) / 10;
}

export function createRFI(input: CreateRFIInput): RFI {
  const createdAt = input.createdAt ?? getNow();
  const status = input.status ?? "open";
  const rfi: RFI = {
    ...input,
    id: input.id ?? nextRFIId(),
    createdAt,
    status,
    history: [
      {
        id: nextHistoryId(),
        action: "created",
        actor: input.requestedBy,
        timestamp: createdAt,
        notes: input.subject,
      },
    ],
  };

  rfis.push(rfi);
  return cloneRFI(rfi);
}

export function getRFIs(projectId?: string): RFI[] {
  const items = projectId ? rfis.filter((rfi) => rfi.projectId === projectId) : rfis;
  return items.map((rfi) => cloneRFI(rfi));
}

export function assignRFI(rfiId: string, assignment: RFIAssignment): RFI {
  const rfiIndex = findRFIIndex(rfiId);
  if (rfiIndex < 0) {
    throw new Error(`RFI not found: ${rfiId}`);
  }

  const assignedAt = assignment.assignedAt ?? getNow();
  const updated: RFI = {
    ...rfis[rfiIndex],
    assignedTo: assignment.assignee,
    status: "assigned",
    history: [
      ...rfis[rfiIndex].history,
      {
        id: nextHistoryId(),
        action: "assigned",
        actor: assignment.assignedBy,
        timestamp: assignedAt,
        notes: assignment.notes ?? `Assigned to ${assignment.assignee}`,
      },
    ],
  };

  rfis[rfiIndex] = updated;
  return cloneRFI(updated);
}

export function respondToRFI(rfiId: string, reply: RFIReply): RFI {
  const rfiIndex = findRFIIndex(rfiId);
  if (rfiIndex < 0) {
    throw new Error(`RFI not found: ${rfiId}`);
  }

  const respondedAt = reply.respondedAt ?? getNow();
  const updated: RFI = {
    ...rfis[rfiIndex],
    status: "answered",
    response: {
      respondedBy: reply.respondedBy,
      respondedAt,
      answer: reply.answer,
    },
    history: [
      ...rfis[rfiIndex].history,
      {
        id: nextHistoryId(),
        action: "responded",
        actor: reply.respondedBy,
        timestamp: respondedAt,
        notes: reply.answer,
      },
    ],
  };

  rfis[rfiIndex] = updated;
  return cloneRFI(updated);
}

export function closeRFI(
  rfiId: string,
  actor: string,
  closedAt = getNow(),
  notes?: string,
): RFI {
  const rfiIndex = findRFIIndex(rfiId);
  if (rfiIndex < 0) {
    throw new Error(`RFI not found: ${rfiId}`);
  }

  const updated: RFI = {
    ...rfis[rfiIndex],
    status: "closed",
    history: [
      ...rfis[rfiIndex].history,
      {
        id: nextHistoryId(),
        action: "closed",
        actor,
        timestamp: closedAt,
        notes,
      },
    ],
  };

  rfis[rfiIndex] = updated;
  return cloneRFI(updated);
}

export function calculateRFIResponseHours(rfiId: string): number | null {
  const rfi = rfis.find((entry) => entry.id === rfiId);
  if (!rfi) {
    throw new Error(`RFI not found: ${rfiId}`);
  }

  if (!rfi.response) {
    return null;
  }

  return calculateHours(rfi.createdAt, rfi.response.respondedAt);
}

export function generateRFILog(
  projectId: string,
  referenceTime = getNow(),
): RFILogEntry[] {
  return getRFIs(projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((rfi) => ({
      id: rfi.id,
      subject: rfi.subject,
      status: rfi.status,
      requestedBy: rfi.requestedBy,
      assignedTo: rfi.assignedTo,
      dueDate: rfi.dueDate,
      responseHours: rfi.response
        ? calculateHours(rfi.createdAt, rfi.response.respondedAt)
        : null,
      isOverdue:
        rfi.status !== "answered" &&
        rfi.status !== "closed" &&
        Boolean(rfi.dueDate) &&
        new Date(referenceTime).getTime() > new Date(rfi.dueDate as string).getTime(),
    }));
}

export function clearRFIs(): void {
  rfis.length = 0;
  rfiCounter = 1;
  historyCounter = 1;
}
