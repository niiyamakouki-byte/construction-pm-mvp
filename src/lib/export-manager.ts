/**
 * Project export/import: bundle projects as JSON, import bundles, generate summaries.
 */

export type ProjectBundle = {
  version: string;
  exportedAt: string;
  projectName: string;
  data: Record<string, unknown>;
  attachments: BundleAttachment[];
  checksum: string;
};

export type BundleAttachment = {
  name: string;
  type: string;
  size: number;
  content: string; // base64 or raw
};

export type ImportResult = {
  success: boolean;
  projectName: string;
  itemsImported: number;
  warnings: string[];
  errors: string[];
};

export type ProjectSummary = {
  projectName: string;
  status: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  progressPct: number;
  totalBudget: number;
  spentBudget: number;
  teamSize: number;
  generatedAt: string;
};

// ── Simple checksum ───────────────────────────────────

function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// ── Export project bundle ─────────────────────────────

export function exportProjectBundle(
  projectName: string,
  data: Record<string, unknown>,
  attachments: BundleAttachment[] = [],
): ProjectBundle {
  const serialized = JSON.stringify(data);
  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    projectName,
    data,
    attachments,
    checksum: simpleChecksum(serialized),
  };
}

// ── Import project bundle ─────────────────────────────

export function importProjectBundle(
  bundleJson: string,
): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let bundle: ProjectBundle;
  try {
    bundle = JSON.parse(bundleJson) as ProjectBundle;
  } catch {
    return {
      success: false,
      projectName: "unknown",
      itemsImported: 0,
      warnings: [],
      errors: ["Invalid JSON format"],
    };
  }

  if (!bundle.version) {
    warnings.push("Missing version field — assuming v1.0.0");
  }

  if (!bundle.projectName) {
    errors.push("Missing projectName");
    return {
      success: false,
      projectName: "unknown",
      itemsImported: 0,
      warnings,
      errors,
    };
  }

  // Verify checksum
  const expectedChecksum = simpleChecksum(JSON.stringify(bundle.data));
  if (bundle.checksum && bundle.checksum !== expectedChecksum) {
    warnings.push("Checksum mismatch — data may have been modified");
  }

  const itemCount = Object.keys(bundle.data ?? {}).length;

  return {
    success: errors.length === 0,
    projectName: bundle.projectName,
    itemsImported: itemCount,
    warnings,
    errors,
  };
}

// ── Generate project summary ──────────────────────────

export function generateProjectSummary(opts: {
  projectName: string;
  status: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  totalBudget: number;
  spentBudget: number;
  teamSize: number;
}): ProjectSummary {
  const progressPct =
    opts.totalTasks > 0
      ? Math.round((opts.completedTasks / opts.totalTasks) * 10000) / 100
      : 0;

  return {
    projectName: opts.projectName,
    status: opts.status,
    startDate: opts.startDate,
    endDate: opts.endDate,
    totalTasks: opts.totalTasks,
    completedTasks: opts.completedTasks,
    progressPct,
    totalBudget: opts.totalBudget,
    spentBudget: opts.spentBudget,
    teamSize: opts.teamSize,
    generatedAt: new Date().toISOString(),
  };
}
