/**
 * Collaborative markup session management — Bluebeam Studio distillation.
 * Pure logic layer: data model, markup management, filtering, export.
 */
import { escapeHtml } from "./utils/escape-html";
import { csvEscape } from "./utils/csv-escape";
import { createRepository } from "./repository/index.js";

// ---- Types ----------------------------------------------------------------

export type MarkupType =
  | "callout"
  | "cloud"
  | "arrow"
  | "highlight"
  | "text"
  | "dimension"
  | "area"
  | "polyline"
  | "stamp"
  | "photo_pin";

export type MarkupStatus =
  | "open"
  | "accepted"
  | "rejected"
  | "resolved"
  | "for_review";

export type MarkupReply = {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
};

export type Markup = {
  id: string;
  drawingId: string;
  pageNumber: number;
  type: MarkupType;
  position: { x: number; y: number };
  size?: { w: number; h: number };
  points?: { x: number; y: number }[];
  content: string;
  author: string;
  status: MarkupStatus;
  color: string;
  layer: string;
  createdAt: Date;
  updatedAt: Date;
  replies: MarkupReply[];
};

export type MarkupLayer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  author: string;
};

export type MarkupSession = {
  id: string;
  drawingId: string;
  projectId: string;
  layers: MarkupLayer[];
  markups: Markup[];
  participants: string[];
  createdAt: Date;
};

export type MarkupSummary = {
  total: number;
  byStatus: Record<MarkupStatus, number>;
  byAuthor: Record<string, number>;
  byType: Record<MarkupType, number>;
  byLayer: Record<string, number>;
};

export type MarkupExportFormat = "csv" | "html" | "bcf";

// ---- Counters -------------------------------------------------------------

let sessionCounter = 1;
let layerCounter = 1;
let markupCounter = 1;
let replyCounter = 1;

export function resetCounters(): void {
  sessionCounter = 1;
  layerCounter = 1;
  markupCounter = 1;
  replyCounter = 1;
}

// ---- Helpers --------------------------------------------------------------

function cloneSession(session: MarkupSession): MarkupSession {
  return {
    ...session,
    layers: session.layers.map((l) => ({ ...l })),
    markups: session.markups.map((m) => ({
      ...m,
      position: { ...m.position },
      size: m.size ? { ...m.size } : undefined,
      points: m.points ? m.points.map((p) => ({ ...p })) : undefined,
      replies: m.replies.map((r) => ({ ...r })),
    })),
    participants: [...session.participants],
  };
}

// ---- Session --------------------------------------------------------------

export function createSession(
  drawingId: string,
  projectId: string,
  creator: string,
): MarkupSession {
  const session: MarkupSession = {
    id: `session-${sessionCounter++}`,
    drawingId,
    projectId,
    layers: [],
    markups: [],
    participants: [creator],
    createdAt: new Date(),
  };
  return cloneSession(session);
}

// ---- Layers ---------------------------------------------------------------

export function addLayer(
  session: MarkupSession,
  name: string,
  color: string,
  author: string,
): MarkupSession {
  const layer: MarkupLayer = {
    id: `layer-${layerCounter++}`,
    name,
    color,
    visible: true,
    locked: false,
    author,
  };
  const updated = cloneSession(session);
  updated.layers.push(layer);
  return updated;
}

export function toggleLayerVisibility(
  session: MarkupSession,
  layerId: string,
): MarkupSession {
  const updated = cloneSession(session);
  const layer = updated.layers.find((l) => l.id === layerId);
  if (!layer) {
    throw new Error(`Layer not found: ${layerId}`);
  }
  layer.visible = !layer.visible;
  return updated;
}

export function lockLayer(
  session: MarkupSession,
  layerId: string,
): MarkupSession {
  const updated = cloneSession(session);
  const layer = updated.layers.find((l) => l.id === layerId);
  if (!layer) {
    throw new Error(`Layer not found: ${layerId}`);
  }
  layer.locked = true;
  return updated;
}

// ---- Markups --------------------------------------------------------------

export type AddMarkupInput = Omit<
  Markup,
  "id" | "drawingId" | "createdAt" | "updatedAt" | "replies" | "status"
> & {
  status?: MarkupStatus;
};

export function addMarkup(
  session: MarkupSession,
  input: AddMarkupInput,
): MarkupSession {
  const layerExists = session.layers.some((l) => l.name === input.layer);
  if (!layerExists) {
    throw new Error(`Layer does not exist: ${input.layer}`);
  }

  const layer = session.layers.find((l) => l.name === input.layer)!;
  if (layer.locked) {
    throw new Error(`Layer is locked: ${input.layer}`);
  }

  const now = new Date();
  const markup: Markup = {
    ...input,
    id: `markup-${markupCounter++}`,
    drawingId: session.drawingId,
    status: input.status ?? "open",
    createdAt: now,
    updatedAt: now,
    replies: [],
  };

  const updated = cloneSession(session);
  updated.markups.push(markup);

  if (!updated.participants.includes(input.author)) {
    updated.participants.push(input.author);
  }

  return updated;
}

export function updateMarkupStatus(
  session: MarkupSession,
  markupId: string,
  newStatus: MarkupStatus,
  _author: string,
): MarkupSession {
  const updated = cloneSession(session);
  const markup = updated.markups.find((m) => m.id === markupId);
  if (!markup) {
    throw new Error(`Markup not found: ${markupId}`);
  }

  const layer = updated.layers.find((l) => l.name === markup.layer);
  if (layer?.locked) {
    throw new Error(`Layer is locked: ${markup.layer}`);
  }

  markup.status = newStatus;
  markup.updatedAt = new Date();
  return updated;
}

export function addReply(
  session: MarkupSession,
  markupId: string,
  author: string,
  content: string,
): MarkupSession {
  const updated = cloneSession(session);
  const markup = updated.markups.find((m) => m.id === markupId);
  if (!markup) {
    throw new Error(`Markup not found: ${markupId}`);
  }

  const reply: MarkupReply = {
    id: `reply-${replyCounter++}`,
    author,
    content,
    createdAt: new Date(),
  };
  markup.replies.push(reply);
  markup.updatedAt = new Date();

  if (!updated.participants.includes(author)) {
    updated.participants.push(author);
  }

  return updated;
}

// ---- Filtering ------------------------------------------------------------

export function getMarkupsByStatus(
  session: MarkupSession,
  status: MarkupStatus,
): Markup[] {
  return session.markups
    .filter((m) => m.status === status)
    .map((m) => ({
      ...m,
      position: { ...m.position },
      size: m.size ? { ...m.size } : undefined,
      points: m.points ? m.points.map((p) => ({ ...p })) : undefined,
      replies: m.replies.map((r) => ({ ...r })),
    }));
}

export function getMarkupsByAuthor(
  session: MarkupSession,
  author: string,
): Markup[] {
  return session.markups
    .filter((m) => m.author === author)
    .map((m) => ({
      ...m,
      position: { ...m.position },
      size: m.size ? { ...m.size } : undefined,
      points: m.points ? m.points.map((p) => ({ ...p })) : undefined,
      replies: m.replies.map((r) => ({ ...r })),
    }));
}

export function getMarkupsByLayer(
  session: MarkupSession,
  layerName: string,
): Markup[] {
  return session.markups
    .filter((m) => m.layer === layerName)
    .map((m) => ({
      ...m,
      position: { ...m.position },
      size: m.size ? { ...m.size } : undefined,
      points: m.points ? m.points.map((p) => ({ ...p })) : undefined,
      replies: m.replies.map((r) => ({ ...r })),
    }));
}

export function getUnresolvedMarkups(session: MarkupSession): Markup[] {
  return session.markups
    .filter((m) => m.status === "open" || m.status === "for_review")
    .map((m) => ({
      ...m,
      position: { ...m.position },
      size: m.size ? { ...m.size } : undefined,
      points: m.points ? m.points.map((p) => ({ ...p })) : undefined,
      replies: m.replies.map((r) => ({ ...r })),
    }));
}

// ---- Summary --------------------------------------------------------------

const ALL_STATUSES: MarkupStatus[] = [
  "open",
  "accepted",
  "rejected",
  "resolved",
  "for_review",
];

export function getMarkupSummary(session: MarkupSession): MarkupSummary {
  const byStatus = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<MarkupStatus, number>,
  );

  const byAuthor: Record<string, number> = {};
  const byType: Partial<Record<MarkupType, number>> = {};
  const byLayer: Record<string, number> = {};

  for (const m of session.markups) {
    byStatus[m.status] += 1;
    byAuthor[m.author] = (byAuthor[m.author] ?? 0) + 1;
    byType[m.type] = (byType[m.type] ?? 0) + 1;
    byLayer[m.layer] = (byLayer[m.layer] ?? 0) + 1;
  }

  return {
    total: session.markups.length,
    byStatus,
    byAuthor,
    byType: byType as Record<MarkupType, number>,
    byLayer,
  };
}

// ---- Export ---------------------------------------------------------------

export function exportMarkupsCSV(session: MarkupSession): string {
  const header = "id,page,type,content,author,status,date";
  const rows = session.markups.map((m) => {
    return [
      m.id,
      m.pageNumber,
      m.type,
      csvEscape(m.content),
      csvEscape(m.author),
      m.status,
      m.createdAt.toISOString(),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

export function buildMarkupReportHtml(
  session: MarkupSession,
  config: { projectName: string; drawingName: string },
): string {
  const statusOrder: MarkupStatus[] = [
    "open",
    "for_review",
    "accepted",
    "rejected",
    "resolved",
  ];

  const grouped = statusOrder.reduce(
    (acc, s) => {
      acc[s] = session.markups.filter((m) => m.status === s);
      return acc;
    },
    {} as Record<MarkupStatus, Markup[]>,
  );

  function renderReplies(replies: MarkupReply[]): string {
    if (replies.length === 0) return "";
    const items = replies
      .map(
        (r) =>
          `<li><strong>${escapeHtml(r.author)}</strong>: ${escapeHtml(r.content)} <em>(${r.createdAt.toISOString()})</em></li>`,
      )
      .join("");
    return `<ul class="replies">${items}</ul>`;
  }

  function renderMarkupRow(m: Markup): string {
    return `<tr>
<td>${escapeHtml(m.id)}</td>
<td>${escapeHtml(m.pageNumber)}</td>
<td>${escapeHtml(m.type)}</td>
<td>${escapeHtml(m.content)}</td>
<td>${escapeHtml(m.author)}</td>
<td>${escapeHtml(m.layer)}</td>
<td>${m.createdAt.toISOString()}</td>
</tr>
${
  m.replies.length > 0
    ? `<tr><td colspan="7">${renderReplies(m.replies)}</td></tr>`
    : ""
}`;
  }

  const sections = statusOrder
    .filter((s) => grouped[s].length > 0)
    .map((s) => {
      const rows = grouped[s].map(renderMarkupRow).join("");
      return `<h2>${escapeHtml(s)}</h2>
<table>
<thead><tr><th>ID</th><th>Page</th><th>Type</th><th>Content</th><th>Author</th><th>Layer</th><th>Date</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Markup Report - ${escapeHtml(config.drawingName)}</title></head><body><h1>Markup Report</h1><p><strong>Project:</strong> ${escapeHtml(config.projectName)}</p><p><strong>Drawing:</strong> ${escapeHtml(config.drawingName)}</p>${sections}</body></html>`;
}

// ---- Session Merge --------------------------------------------------------

export function mergeMarkupSessions(sessions: MarkupSession[]): MarkupSession {
  if (sessions.length === 0) {
    throw new Error("Cannot merge zero sessions");
  }

  const base = sessions[0];
  const merged: MarkupSession = {
    id: `session-${sessionCounter++}`,
    drawingId: base.drawingId,
    projectId: base.projectId,
    layers: [],
    markups: [],
    participants: [],
    createdAt: new Date(),
  };

  const seenLayerNames = new Set<string>();
  const seenParticipants = new Set<string>();

  for (const session of sessions) {
    for (const layer of session.layers) {
      if (!seenLayerNames.has(layer.name)) {
        seenLayerNames.add(layer.name);
        merged.layers.push({ ...layer });
      }
    }
    for (const markup of session.markups) {
      merged.markups.push({
        ...markup,
        position: { ...markup.position },
        size: markup.size ? { ...markup.size } : undefined,
        points: markup.points ? markup.points.map((p) => ({ ...p })) : undefined,
        replies: markup.replies.map((r) => ({ ...r })),
      });
    }
    for (const participant of session.participants) {
      if (!seenParticipants.has(participant)) {
        seenParticipants.add(participant);
        merged.participants.push(participant);
      }
    }
  }

  return merged;
}

// Repository-pattern accessor (for gradual migration to Supabase)
export const markupSessionRepository = createRepository<MarkupSession>('markup_sessions');
