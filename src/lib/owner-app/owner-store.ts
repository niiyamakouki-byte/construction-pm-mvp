/**
 * owner-app/owner-store.ts — OwnerStore シングルトン
 * localStorage: genbahub:owner-state
 * FIFO: 1000 messages / 100 requests per project
 */

import type { OwnerMessage, ChangeRequest, ChangeRequestStatus } from "./types.js";

const STORAGE_KEY = "genbahub:owner-state";
const MAX_MESSAGES = 1000;
const MAX_REQUESTS = 100;

type ProjectState = {
  messages: OwnerMessage[];
  requests: ChangeRequest[];
};

type OwnerState = Record<string, ProjectState>;

function loadState(): OwnerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OwnerState;
  } catch {
    return {};
  }
}

function saveState(state: OwnerState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getProjectState(state: OwnerState, projectId: string): ProjectState {
  if (!state[projectId]) {
    state[projectId] = { messages: [], requests: [] };
  }
  return state[projectId];
}

class OwnerStoreClass extends EventTarget {
  getSnapshot(projectId: string): { messages: OwnerMessage[]; requests: ChangeRequest[] } {
    const state = loadState();
    const ps = getProjectState(state, projectId);
    return { messages: [...ps.messages], requests: [...ps.requests] };
  }

  addMessage(projectId: string, message: OwnerMessage): void {
    const state = loadState();
    const ps = getProjectState(state, projectId);
    ps.messages.push(message);
    // FIFO cap
    if (ps.messages.length > MAX_MESSAGES) {
      ps.messages = ps.messages.slice(ps.messages.length - MAX_MESSAGES);
    }
    saveState(state);
    this.dispatchEvent(new CustomEvent("change", { detail: { projectId } }));
  }

  submitChangeRequest(projectId: string, request: ChangeRequest): void {
    const state = loadState();
    const ps = getProjectState(state, projectId);
    ps.requests.push(request);
    // FIFO cap
    if (ps.requests.length > MAX_REQUESTS) {
      ps.requests = ps.requests.slice(ps.requests.length - MAX_REQUESTS);
    }
    saveState(state);
    this.dispatchEvent(new CustomEvent("change", { detail: { projectId } }));
  }

  updateRequestStatus(
    requestId: string,
    status: ChangeRequestStatus,
    estimated_cost?: number,
  ): void {
    const state = loadState();
    let found = false;
    for (const ps of Object.values(state)) {
      const idx = ps.requests.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        ps.requests[idx] = {
          ...ps.requests[idx],
          status,
          ...(estimated_cost !== undefined ? { estimated_cost } : {}),
        };
        found = true;
        break;
      }
    }
    if (found) {
      saveState(state);
      this.dispatchEvent(new CustomEvent("change", { detail: { requestId } }));
    }
  }

  /** テスト用リセット */
  _reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const ownerStore = new OwnerStoreClass();
