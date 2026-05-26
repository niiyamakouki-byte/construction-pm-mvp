/**
 * owner-store.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ownerStore } from "../owner-store.js";
import type { ChangeRequest, OwnerMessage } from "../types.js";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorage.clear();
  ownerStore._reset();
});

afterEach(() => {
  localStorage.clear();
});

function makeMessage(id: string, sender: "owner" | "pm" = "owner"): OwnerMessage {
  return { id, sender, text: `text-${id}`, ts: new Date().toISOString() };
}

function makeRequest(id: string, projectId = "proj-1"): ChangeRequest {
  return {
    id,
    projectId,
    title: `req-${id}`,
    body: "body",
    photo_urls: [],
    status: "pending",
    ts: new Date().toISOString(),
  };
}

describe("getSnapshot", () => {
  it("returns empty state for unknown project", () => {
    const snap = ownerStore.getSnapshot("no-such-project");
    expect(snap.messages).toEqual([]);
    expect(snap.requests).toEqual([]);
  });

  it("returns copies, not references", () => {
    ownerStore.addMessage("p1", makeMessage("m1"));
    const s1 = ownerStore.getSnapshot("p1");
    s1.messages.push(makeMessage("mutated"));
    const s2 = ownerStore.getSnapshot("p1");
    expect(s2.messages).toHaveLength(1);
  });
});

describe("addMessage", () => {
  it("persists message to the project", () => {
    ownerStore.addMessage("p1", makeMessage("m1"));
    const { messages } = ownerStore.getSnapshot("p1");
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("m1");
  });

  it("appends multiple messages in order", () => {
    ownerStore.addMessage("p1", makeMessage("m1"));
    ownerStore.addMessage("p1", makeMessage("m2"));
    const { messages } = ownerStore.getSnapshot("p1");
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("keeps messages for different projects separate", () => {
    ownerStore.addMessage("pA", makeMessage("mA"));
    ownerStore.addMessage("pB", makeMessage("mB"));
    expect(ownerStore.getSnapshot("pA").messages).toHaveLength(1);
    expect(ownerStore.getSnapshot("pB").messages).toHaveLength(1);
  });

  it("enforces FIFO cap of 1000", () => {
    for (let i = 0; i < 1050; i++) {
      ownerStore.addMessage("p-cap", makeMessage(`m${i}`));
    }
    const { messages } = ownerStore.getSnapshot("p-cap");
    expect(messages.length).toBe(1000);
    // Should keep the most recent 1000
    expect(messages[0].id).toBe("m50");
    expect(messages[999].id).toBe("m1049");
  });

  it("fires 'change' event", () => {
    const handler = vi.fn();
    ownerStore.addEventListener("change", handler);
    ownerStore.addMessage("p1", makeMessage("m1"));
    ownerStore.removeEventListener("change", handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("persists across re-reads (localStorage)", () => {
    ownerStore.addMessage("persist-p", makeMessage("m-persist"));
    // Simulate re-read by calling getSnapshot again
    const snap = ownerStore.getSnapshot("persist-p");
    expect(snap.messages).toHaveLength(1);
  });
});

describe("submitChangeRequest", () => {
  it("stores request under project", () => {
    ownerStore.submitChangeRequest("p1", makeRequest("r1"));
    const { requests } = ownerStore.getSnapshot("p1");
    expect(requests).toHaveLength(1);
    expect(requests[0].id).toBe("r1");
  });

  it("enforces FIFO cap of 100", () => {
    for (let i = 0; i < 110; i++) {
      ownerStore.submitChangeRequest("p-cap2", makeRequest(`r${i}`, "p-cap2"));
    }
    const { requests } = ownerStore.getSnapshot("p-cap2");
    expect(requests.length).toBe(100);
    expect(requests[0].id).toBe("r10");
  });

  it("fires 'change' event", () => {
    const handler = vi.fn();
    ownerStore.addEventListener("change", handler);
    ownerStore.submitChangeRequest("p1", makeRequest("r-evt"));
    ownerStore.removeEventListener("change", handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("updateRequestStatus", () => {
  it("updates status of an existing request", () => {
    ownerStore.submitChangeRequest("p1", makeRequest("r-update"));
    ownerStore.updateRequestStatus("r-update", "approved");
    const { requests } = ownerStore.getSnapshot("p1");
    expect(requests[0].status).toBe("approved");
  });

  it("updates estimated_cost when provided", () => {
    ownerStore.submitChangeRequest("p1", makeRequest("r-cost"));
    ownerStore.updateRequestStatus("r-cost", "reviewing", 50000);
    const { requests } = ownerStore.getSnapshot("p1");
    expect(requests[0].estimated_cost).toBe(50000);
  });

  it("does not set estimated_cost when omitted", () => {
    ownerStore.submitChangeRequest("p1", makeRequest("r-nocost"));
    ownerStore.updateRequestStatus("r-nocost", "rejected");
    const { requests } = ownerStore.getSnapshot("p1");
    expect(requests[0].estimated_cost).toBeUndefined();
  });

  it("fires 'change' event when request is found", () => {
    ownerStore.submitChangeRequest("p1", makeRequest("r-ev2"));
    const handler = vi.fn();
    ownerStore.addEventListener("change", handler);
    ownerStore.updateRequestStatus("r-ev2", "approved");
    ownerStore.removeEventListener("change", handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not throw for unknown requestId", () => {
    expect(() => ownerStore.updateRequestStatus("no-such", "approved")).not.toThrow();
  });

  it("supports all status values", () => {
    const statuses = ["pending", "reviewing", "approved", "rejected"] as const;
    for (const s of statuses) {
      ownerStore._reset();
      ownerStore.submitChangeRequest("ps", makeRequest("rs", "ps"));
      ownerStore.updateRequestStatus("rs", s);
      expect(ownerStore.getSnapshot("ps").requests[0].status).toBe(s);
    }
  });
});

describe("_reset", () => {
  it("clears all state", () => {
    ownerStore.addMessage("p1", makeMessage("m1"));
    ownerStore.submitChangeRequest("p1", makeRequest("r1"));
    ownerStore._reset();
    const snap = ownerStore.getSnapshot("p1");
    expect(snap.messages).toHaveLength(0);
    expect(snap.requests).toHaveLength(0);
  });
});
