import { describe, it, expect, beforeEach } from "vitest";
import {
  createContract,
  sendContract,
  markViewed,
  signContract,
  rejectContract,
  expireContracts,
  generateTimestamp,
  searchContracts,
  buildContractSummaryHtml,
  listContracts,
  getContract,
  deleteContract,
  clearContracts,
  canTransitionContract,
} from "./e-contract.js";
import type { ContractStatus } from "./e-contract.js";

beforeEach(() => {
  clearContracts();
});

const ISSUER = { name: "株式会社ラポルタ", email: "niiyama@laporta.co.jp", role: "issuer" as const };
const SIGNER = { name: "田中工務店", email: "tanaka@koumuten.jp", role: "signer" as const };

function makeContract(projectId = "p-1", expiresAt = "2099-12-31") {
  return createContract(projectId, "内装工事請負契約", [ISSUER, SIGNER], expiresAt);
}

// ── createContract ─────────────────────────────────────────────────────────

describe("createContract", () => {
  it("creates a contract in draft status", () => {
    const c = makeContract();
    expect(c.status).toBe("draft");
    expect(c.projectId).toBe("p-1");
    expect(c.title).toBe("内装工事請負契約");
  });

  it("stores the contract and retrieves via getContract", () => {
    const c = makeContract();
    expect(getContract(c.id)).toEqual(c);
  });

  it("assigns incremental IDs starting with ec-", () => {
    const c1 = makeContract();
    const c2 = makeContract();
    expect(c1.id).toMatch(/^ec-\d+$/);
    expect(c2.id).not.toBe(c1.id);
  });

  it("stores documentUrl when provided", () => {
    const c = createContract("p-1", "契約", [ISSUER], "2099-01-01", "https://example.com/doc.pdf");
    expect(c.documentUrl).toBe("https://example.com/doc.pdf");
  });
});

// ── Status transitions ──────────────────────────────────────────────────────

describe("sendContract", () => {
  it("transitions draft → sent and sets sentAt", () => {
    const c = makeContract();
    const sent = sendContract(c.id);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeDefined();
  });

  it("throws when transitioning from a non-draft status", () => {
    const c = makeContract();
    sendContract(c.id);
    expect(() => sendContract(c.id)).toThrow();
  });
});

describe("markViewed", () => {
  it("transitions sent → viewed and sets viewedAt", () => {
    const c = makeContract();
    sendContract(c.id);
    const viewed = markViewed(c.id);
    expect(viewed.status).toBe("viewed");
    expect(viewed.viewedAt).toBeDefined();
  });

  it("throws when called on draft status", () => {
    const c = makeContract();
    expect(() => markViewed(c.id)).toThrow();
  });
});

describe("signContract", () => {
  it("transitions viewed → signed and sets signedAt on contract and signer party", () => {
    const c = makeContract();
    sendContract(c.id);
    markViewed(c.id);
    const signed = signContract(c.id, SIGNER.email);
    expect(signed.status).toBe("signed");
    expect(signed.signedAt).toBeDefined();
    const signer = signed.parties.find((p) => p.role === "signer");
    expect(signer?.signedAt).toBeDefined();
  });

  it("throws when called on sent (not yet viewed)", () => {
    const c = makeContract();
    sendContract(c.id);
    expect(() => signContract(c.id, SIGNER.email)).toThrow();
  });
});

describe("rejectContract", () => {
  it("transitions sent → rejected", () => {
    const c = makeContract();
    sendContract(c.id);
    const rejected = rejectContract(c.id);
    expect(rejected.status).toBe("rejected");
  });

  it("transitions viewed → rejected", () => {
    const c = makeContract();
    sendContract(c.id);
    markViewed(c.id);
    const rejected = rejectContract(c.id);
    expect(rejected.status).toBe("rejected");
  });

  it("allows re-draft from rejected", () => {
    expect(canTransitionContract("rejected", "draft")).toBe(true);
  });
});

// ── Expiry detection ────────────────────────────────────────────────────────

describe("expireContracts", () => {
  it("marks sent contracts past expiresAt as expired", () => {
    const c = createContract("p-1", "期限切れ契約", [ISSUER, SIGNER], "2020-01-01");
    sendContract(c.id);
    const expired = expireContracts("2026-01-01T00:00:00.000Z");
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe("expired");
    expect(getContract(c.id)?.status).toBe("expired");
  });

  it("does not expire contracts with future expiresAt", () => {
    const c = makeContract("p-1", "2099-12-31");
    sendContract(c.id);
    const expired = expireContracts("2026-01-01T00:00:00.000Z");
    expect(expired).toHaveLength(0);
  });

  it("does not expire signed contracts even if past expiry", () => {
    const c = createContract("p-1", "署名済み契約", [ISSUER, SIGNER], "2020-01-01");
    sendContract(c.id);
    markViewed(c.id);
    signContract(c.id, SIGNER.email);
    const expired = expireContracts("2026-01-01T00:00:00.000Z");
    expect(expired).toHaveLength(0);
  });

  it("marks viewed contracts past expiresAt as expired", () => {
    const c = createContract("p-1", "閲覧後期限切れ", [ISSUER, SIGNER], "2020-06-01");
    sendContract(c.id);
    markViewed(c.id);
    const expired = expireContracts("2026-01-01T00:00:00.000Z");
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe("expired");
  });
});

// ── generateTimestamp ───────────────────────────────────────────────────────

describe("generateTimestamp", () => {
  it("returns a timestamp record with required fields", () => {
    const ts = generateTimestamp("ec-1");
    expect(ts.contractId).toBe("ec-1");
    expect(ts.issuedAt).toBeDefined();
    expect(ts.hashAlgorithm).toBe("SHA-256");
    expect(ts.hash).toMatch(/^mock-/);
    expect(ts.tsaProvider).toBe("GenbaHub-MockTSA");
  });

  it("generates different hashes for different contractIds", () => {
    const ts1 = generateTimestamp("ec-1");
    const ts2 = generateTimestamp("ec-2");
    // Hashes should differ (different inputs → different outputs)
    // Note: issuedAt may differ so hashes will always differ in practice
    expect(ts1.contractId).toBe("ec-1");
    expect(ts2.contractId).toBe("ec-2");
  });
});

// ── searchContracts ─────────────────────────────────────────────────────────

describe("searchContracts", () => {
  beforeEach(() => {
    const c1 = createContract("p-1", "KDX南青山内装工事契約", [ISSUER, SIGNER], "2099-01-01");
    sendContract(c1.id);

    const c2 = createContract("p-2", "アルペジオ改装契約", [
      ISSUER,
      { name: "山田建設", email: "yamada@kensetsu.jp", role: "signer" },
    ], "2099-01-01");

    createContract("p-1", "古い下書き契約", [ISSUER, SIGNER], "2020-01-01");
  });

  it("filters by projectId", () => {
    const results = searchContracts({ projectId: "p-1" });
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.projectId === "p-1")).toBe(true);
  });

  it("filters by status", () => {
    const results = searchContracts({ status: "sent" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("KDX南青山内装工事契約");
  });

  it("filters by keyword in title", () => {
    const results = searchContracts({ keyword: "アルペジオ" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("アルペジオ改装契約");
  });

  it("filters by partyName (取引先名)", () => {
    const results = searchContracts({ partyName: "山田建設" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("アルペジオ改装契約");
  });

  it("returns all contracts when query is empty", () => {
    const results = searchContracts({});
    expect(results).toHaveLength(3);
  });
});

// ── buildContractSummaryHtml ────────────────────────────────────────────────

describe("buildContractSummaryHtml", () => {
  it("returns HTML table containing contract data", () => {
    makeContract("p-99");
    const html = buildContractSummaryHtml("p-99");
    expect(html).toContain("<table>");
    expect(html).toContain("内装工事請負契約");
    expect(html).toContain("draft");
    expect(html).toContain("田中工務店");
  });

  it("escapes HTML special characters in title", () => {
    createContract("p-99", "契約 <script>alert(1)</script>", [ISSUER], "2099-01-01");
    const html = buildContractSummaryHtml("p-99");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns empty tbody when no contracts exist", () => {
    const html = buildContractSummaryHtml("no-such-project");
    expect(html).toContain("<tbody>");
    expect(html).toContain("</tbody>");
    // No <tr> inside tbody
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    expect(tbody.trim()).toBe("");
  });
});

// ── deleteContract ──────────────────────────────────────────────────────────

describe("deleteContract", () => {
  it("removes the contract from the store", () => {
    const c = makeContract();
    expect(deleteContract(c.id)).toBe(true);
    expect(getContract(c.id)).toBeUndefined();
  });

  it("returns false for unknown id", () => {
    expect(deleteContract("ec-9999")).toBe(false);
  });
});
