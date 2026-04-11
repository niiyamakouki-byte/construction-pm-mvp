/**
 * Electronic contract management — draft, send, sign, and archive contracts.
 * Includes 電子帳簿保存法対応 timestamp generation (mock) and search.
 */
import { escapeHtml } from "./utils/escape-html";

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "rejected"
  | "expired";

export type PartyInfo = {
  name: string;
  email: string;
  role: "issuer" | "signer";
  signedAt?: string;
};

export type Contract = {
  id: string;
  projectId: string;
  title: string;
  parties: PartyInfo[];
  documentUrl?: string;
  status: ContractStatus;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  expiresAt: string;
  createdAt: string;
};

// ── Status transition rules ─────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "rejected", "expired"],
  viewed: ["signed", "rejected", "expired"],
  signed: [],
  rejected: ["draft"],
  expired: ["draft"],
};

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ── In-memory store ─────────────────────────────────────────────────────────

const contracts: Map<string, Contract> = new Map();
let nextId = 1;

// ── Core CRUD functions ─────────────────────────────────────────────────────

export function createContract(
  projectId: string,
  title: string,
  parties: PartyInfo[],
  expiresAt: string,
  documentUrl?: string,
): Contract {
  const now = new Date().toISOString();
  const contract: Contract = {
    id: `ec-${nextId++}`,
    projectId,
    title,
    parties,
    documentUrl,
    status: "draft",
    expiresAt,
    createdAt: now,
  };
  contracts.set(contract.id, contract);
  return contract;
}

export function getContract(id: string): Contract | undefined {
  return contracts.get(id);
}

export function listContracts(projectId?: string): Contract[] {
  const all = Array.from(contracts.values());
  if (projectId) return all.filter((c) => c.projectId === projectId);
  return all;
}

export function deleteContract(id: string): boolean {
  return contracts.delete(id);
}

export function clearContracts(): void {
  contracts.clear();
  nextId = 1;
}

// ── Status transition functions ─────────────────────────────────────────────

export function sendContract(id: string): Contract {
  const contract = contracts.get(id);
  if (!contract) throw new Error(`Contract not found: ${id}`);
  if (!canTransitionContract(contract.status, "sent")) {
    throw new Error(`Invalid transition: ${contract.status} → sent`);
  }
  const now = new Date().toISOString();
  const updated: Contract = { ...contract, status: "sent", sentAt: now };
  contracts.set(id, updated);
  return updated;
}

export function markViewed(id: string): Contract {
  const contract = contracts.get(id);
  if (!contract) throw new Error(`Contract not found: ${id}`);
  if (!canTransitionContract(contract.status, "viewed")) {
    throw new Error(`Invalid transition: ${contract.status} → viewed`);
  }
  const now = new Date().toISOString();
  const updated: Contract = { ...contract, status: "viewed", viewedAt: now };
  contracts.set(id, updated);
  return updated;
}

export function signContract(id: string, signerEmail: string): Contract {
  const contract = contracts.get(id);
  if (!contract) throw new Error(`Contract not found: ${id}`);
  if (!canTransitionContract(contract.status, "signed")) {
    throw new Error(`Invalid transition: ${contract.status} → signed`);
  }
  const now = new Date().toISOString();
  const updatedParties = contract.parties.map((p) =>
    p.email === signerEmail && p.role === "signer" ? { ...p, signedAt: now } : p,
  );
  const updated: Contract = {
    ...contract,
    status: "signed",
    signedAt: now,
    parties: updatedParties,
  };
  contracts.set(id, updated);
  return updated;
}

export function rejectContract(id: string): Contract {
  const contract = contracts.get(id);
  if (!contract) throw new Error(`Contract not found: ${id}`);
  if (!canTransitionContract(contract.status, "rejected")) {
    throw new Error(`Invalid transition: ${contract.status} → rejected`);
  }
  const updated: Contract = { ...contract, status: "rejected" };
  contracts.set(id, updated);
  return updated;
}

// ── Expiry detection ────────────────────────────────────────────────────────

/**
 * Check and update contracts that have passed their expiresAt date.
 * Returns the list of contracts that were transitioned to expired.
 */
export function expireContracts(now?: string): Contract[] {
  const nowDate = now ?? new Date().toISOString();
  const expired: Contract[] = [];
  for (const contract of contracts.values()) {
    if (
      (contract.status === "sent" || contract.status === "viewed") &&
      contract.expiresAt < nowDate
    ) {
      const updated: Contract = { ...contract, status: "expired" };
      contracts.set(contract.id, updated);
      expired.push(updated);
    }
  }
  return expired;
}

// ── 電子帳簿保存法対応: タイムスタンプ生成（モック）────────────────────────

export type TimestampRecord = {
  contractId: string;
  issuedAt: string;
  hashAlgorithm: string;
  hash: string;
  tsaProvider: string;
};

/**
 * Generate a mock trusted timestamp for 電子帳簿保存法 compliance.
 * In production this would call a TSA (Time Stamp Authority).
 */
export function generateTimestamp(contractId: string, documentContent?: string): TimestampRecord {
  const now = new Date().toISOString();
  const seed = contractId + (documentContent ?? "") + now;
  // Simple deterministic mock hash (not cryptographic)
  const hash = seed
    .split("")
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
    .toString(16)
    .padStart(8, "0");
  return {
    contractId,
    issuedAt: now,
    hashAlgorithm: "SHA-256",
    hash: `mock-${hash}`,
    tsaProvider: "GenbaHub-MockTSA",
  };
}

// ── 検索要件対応 ─────────────────────────────────────────────────────────────

export type ContractSearchQuery = {
  keyword?: string;        // title or party name
  partyName?: string;      // 取引先名
  status?: ContractStatus;
  fromDate?: string;       // createdAt >= fromDate (YYYY-MM-DD)
  toDate?: string;         // createdAt <= toDate (YYYY-MM-DD)
  projectId?: string;
};

/**
 * Search contracts by date range, party name (取引先), keyword, or status.
 */
export function searchContracts(query: ContractSearchQuery): Contract[] {
  return Array.from(contracts.values()).filter((c) => {
    if (query.projectId && c.projectId !== query.projectId) return false;
    if (query.status && c.status !== query.status) return false;
    if (query.fromDate && c.createdAt.slice(0, 10) < query.fromDate) return false;
    if (query.toDate && c.createdAt.slice(0, 10) > query.toDate) return false;
    if (query.partyName) {
      const match = c.parties.some((p) => p.name.includes(query.partyName!));
      if (!match) return false;
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      const inTitle = c.title.toLowerCase().includes(kw);
      const inParties = c.parties.some((p) => p.name.toLowerCase().includes(kw));
      if (!inTitle && !inParties) return false;
    }
    return true;
  });
}

// ── 帳票: 契約一覧HTML ───────────────────────────────────────────────────────

/**
 * Build a contract summary HTML table for printing / archiving.
 */
export function buildContractSummaryHtml(projectId?: string): string {
  const list = listContracts(projectId);
  const rows = list
    .map((c) => {
      const signer = c.parties.find((p) => p.role === "signer");
      return `<tr>
  <td>${c.id}</td>
  <td>${escapeHtml(c.title)}</td>
  <td>${signer ? escapeHtml(signer.name) : ""}</td>
  <td>${c.status}</td>
  <td>${c.createdAt.slice(0, 10)}</td>
  <td>${c.expiresAt.slice(0, 10)}</td>
</tr>`;
    })
    .join("\n");

  return `<table>
<thead>
<tr><th>ID</th><th>タイトル</th><th>署名者</th><th>ステータス</th><th>作成日</th><th>有効期限</th></tr>
</thead>
<tbody>
${rows}
</tbody>
</table>`;
}

