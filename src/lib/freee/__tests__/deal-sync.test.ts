import { describe, it, expect, vi, afterEach } from "vitest";
import { syncProjectToFreee, syncProjectsToFreee } from "../deal-sync.js";
import { FreeeClient } from "../client.js";
import type { Project } from "../../../domain/types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ─────────────────────────────────────────

const project: Project = {
  id: "proj-001",
  name: "KDX南青山リノベ",
  description: "内装工事",
  status: "active",
  startDate: "2025-04-01",
  endDate: "2025-09-30",
  budget: 6_100_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

// ── syncProjectToFreee — skipped ──────────────────────

describe("syncProjectToFreee — unconfigured", () => {
  it("returns skipped when client not configured", async () => {
    const client = new FreeeClient();   // no token
    const result = await syncProjectToFreee(client, 1, project);
    expect(result.status).toBe("skipped");
    expect(result.projectId).toBe("proj-001");
  });
});

// ── syncProjectToFreee — created ──────────────────────

describe("syncProjectToFreee — new project", () => {
  it("creates deal when no existing deal with same ref_number", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        // 1st call: listDeals → empty
        // 2nd call: createDeal → new deal
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ deals: [], meta: { total_count: 0 } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            deal: {
              id: 500,
              company_id: 1,
              issue_date: "2025-04-01",
              amount: 6_100_000,
              type: "income",
              status: "unsettled",
              ref_number: "proj-001",
              details: [],
            },
          }),
        });
      }),
    );

    const client = new FreeeClient("token");
    const result = await syncProjectToFreee(client, 1, project);
    expect(result.status).toBe("created");
    expect(result.freeeDealsId).toBe(500);
  });
});

// ── syncProjectToFreee — already_synced ───────────────

describe("syncProjectToFreee — duplicate", () => {
  it("returns already_synced when deal with same ref_number exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          deals: [
            {
              id: 300,
              company_id: 1,
              issue_date: "2025-04-01",
              amount: 6_100_000,
              type: "income",
              status: "unsettled",
              ref_number: "proj-001",
              details: [],
            },
          ],
          meta: { total_count: 1 },
        }),
      }),
    );

    const client = new FreeeClient("token");
    const result = await syncProjectToFreee(client, 1, project);
    expect(result.status).toBe("already_synced");
    expect(result.freeeDealsId).toBe(300);
  });
});

// ── syncProjectToFreee — error ────────────────────────

describe("syncProjectToFreee — error handling", () => {
  it("returns error status on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );

    const client = new FreeeClient("token");
    const result = await syncProjectToFreee(client, 1, project);
    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });
});

// ── syncProjectsToFreee — batch ───────────────────────

describe("syncProjectsToFreee — batch", () => {
  it("returns skipped results for all projects when unconfigured", async () => {
    const client = new FreeeClient();
    const p2: Project = { ...project, id: "proj-002" };
    const results = await syncProjectsToFreee(client, 1, [project, p2]);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.status).toBe("skipped"));
  });
});
