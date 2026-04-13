/**
 * Remote Inspection module — Log System蒸留
 * VR/360度リモート施工管理。定点撮影比較・遠隔巡回・アバターロボット監視。
 */
import { escapeHtml } from "./utils/escape-html";
import { csvEscape } from "./utils/csv-escape";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type CapturePoint = {
  id: string;
  projectId: string;
  location: string;
  floor: number;
  room?: string;
  position: { x: number; y: number };
  capturedAt: Date;
  photoUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
};

export type InspectionRoute = {
  id: string;
  projectId: string;
  name: string;
  points: CapturePoint[];
  createdAt: Date;
  inspectorName?: string;
};

export type InspectionFinding = {
  id: string;
  pointId: string;
  severity: "critical" | "major" | "minor" | "observation";
  category: string;
  description: string;
  photoRef?: string;
  status: "open" | "resolved" | "deferred";
};

export type RemoteInspection = {
  id: string;
  projectId: string;
  route: InspectionRoute;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  inspector: string;
  scheduledAt: Date;
  completedAt?: Date;
  findings: InspectionFinding[];
};

export type ProgressComparison = {
  pointId: string;
  location: string;
  captures: { date: Date; photoUrl?: string }[];
  progressNotes: string[];
  changeDetected: boolean;
};

export type RemoteInspectionReport = {
  inspection: RemoteInspection;
  summary: {
    totalPoints: number;
    findingsCount: number;
    criticalCount: number;
    resolvedCount: number;
  };
  progressComparisons: ProgressComparison[];
};

// ── In-memory stores ─────────────────────────────────────────────────────────

const capturePoints = new Map<string, CapturePoint>();
const inspectionRoutes = new Map<string, InspectionRoute>();
const remoteInspections = new Map<string, RemoteInspection>();

// ── テスト用リセット ──────────────────────────────────────────────────────────

/**
 * テスト用: 全データをリセットする。
 */
export function clearRemoteInspectionData(): void {
  capturePoints.clear();
  inspectionRoutes.clear();
  remoteInspections.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return crypto.randomUUID();
}

// ── CapturePoint ─────────────────────────────────────────────────────────────

/**
 * 定点撮影ポイントを新規作成する。
 */
export function createCapturePoint(
  projectId: string,
  location: string,
  floor: number,
  position: { x: number; y: number },
  room?: string,
): CapturePoint {
  const point: CapturePoint = {
    id: genId(),
    projectId,
    location,
    floor,
    room,
    position,
    capturedAt: new Date(),
    tags: [],
  };
  capturePoints.set(point.id, { ...point });
  return { ...point };
}

// ── InspectionRoute ──────────────────────────────────────────────────────────

/**
 * 巡回ルートを作成する。pointIds の順序でポイントを並べる。
 */
export function createInspectionRoute(
  projectId: string,
  name: string,
  pointIds: string[],
): InspectionRoute {
  const points = pointIds.map((id) => {
    const p = capturePoints.get(id);
    if (!p) throw new Error(`CapturePoint ${id} not found`);
    return { ...p };
  });
  const route: InspectionRoute = {
    id: genId(),
    projectId,
    name,
    points,
    createdAt: new Date(),
  };
  inspectionRoutes.set(route.id, { ...route, points: [...route.points] });
  return { ...route, points: [...route.points] };
}

// ── RemoteInspection ─────────────────────────────────────────────────────────

/**
 * リモート検査をスケジュールする。
 */
export function scheduleInspection(
  projectId: string,
  routeId: string,
  inspector: string,
  scheduledAt: Date,
): RemoteInspection {
  const route = inspectionRoutes.get(routeId);
  if (!route) throw new Error(`InspectionRoute ${routeId} not found`);

  const inspection: RemoteInspection = {
    id: genId(),
    projectId,
    route: { ...route, points: [...route.points] },
    status: "scheduled",
    inspector,
    scheduledAt,
    findings: [],
  };
  remoteInspections.set(inspection.id, {
    ...inspection,
    findings: [],
  });
  return { ...inspection, findings: [] };
}

/**
 * 検査を開始する（scheduled → in_progress）。
 */
export function startInspection(inspection: RemoteInspection): RemoteInspection {
  if (inspection.status !== "scheduled") {
    throw new Error(`Cannot start inspection with status: ${inspection.status}`);
  }
  const updated: RemoteInspection = {
    ...inspection,
    status: "in_progress",
    findings: [...inspection.findings],
  };
  remoteInspections.set(updated.id, { ...updated, findings: [...updated.findings] });
  return { ...updated, findings: [...updated.findings] };
}

/**
 * 検査指摘を追加する。
 */
export function addFinding(
  inspection: RemoteInspection,
  pointId: string,
  severity: InspectionFinding["severity"],
  category: string,
  description: string,
): RemoteInspection {
  const finding: InspectionFinding = {
    id: genId(),
    pointId,
    severity,
    category,
    description,
    status: "open",
  };
  const updated: RemoteInspection = {
    ...inspection,
    findings: [...inspection.findings, finding],
  };
  remoteInspections.set(updated.id, { ...updated, findings: [...updated.findings] });
  return { ...updated, findings: [...updated.findings] };
}

/**
 * 検査を完了する（in_progress → completed）。
 */
export function completeInspection(inspection: RemoteInspection): RemoteInspection {
  if (inspection.status !== "in_progress") {
    throw new Error(`Cannot complete inspection with status: ${inspection.status}`);
  }
  const updated: RemoteInspection = {
    ...inspection,
    status: "completed",
    completedAt: new Date(),
    findings: [...inspection.findings],
  };
  remoteInspections.set(updated.id, { ...updated, findings: [...updated.findings] });
  return { ...updated, findings: [...updated.findings] };
}

/**
 * 指定の指摘を解決済みにする。
 */
export function resolveFindings(
  inspection: RemoteInspection,
  findingIds: string[],
): RemoteInspection {
  const idSet = new Set(findingIds);
  const findings = inspection.findings.map((f) =>
    idSet.has(f.id) ? { ...f, status: "resolved" as const } : { ...f },
  );
  const updated: RemoteInspection = { ...inspection, findings };
  remoteInspections.set(updated.id, { ...updated, findings: [...updated.findings] });
  return { ...updated, findings: [...updated.findings] };
}

// ── Progress comparison ───────────────────────────────────────────────────────

/**
 * 同一ポイントの時系列撮影を比較し、変化を検知する。
 * dateRange を指定すると期間絞り込みを行う。
 */
export function compareProgress(
  points: CapturePoint[],
  dateRange?: { from: Date; to: Date },
): ProgressComparison[] {
  // Group points by location+floor key
  const grouped = new Map<string, CapturePoint[]>();
  for (const p of points) {
    const key = `${p.projectId}::${p.location}::${p.floor}`;
    const list = grouped.get(key) ?? [];
    list.push(p);
    grouped.set(key, list);
  }

  const results: ProgressComparison[] = [];
  for (const [, group] of grouped) {
    // Sort by capturedAt ascending
    const sorted = [...group].sort(
      (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
    );

    let captures = sorted.map((p) => ({ date: p.capturedAt, photoUrl: p.photoUrl }));

    if (dateRange) {
      captures = captures.filter(
        (c) => c.date >= dateRange.from && c.date <= dateRange.to,
      );
    }

    const changeDetected = captures.length >= 2;
    const progressNotes: string[] = [];
    if (changeDetected) {
      progressNotes.push(
        `${captures.length}回の撮影で変化を検知 (${captures[0].date.toISOString().slice(0, 10)} → ${captures[captures.length - 1].date.toISOString().slice(0, 10)})`,
      );
    }

    results.push({
      pointId: group[0].id,
      location: group[0].location,
      captures,
      progressNotes,
      changeDetected,
    });
  }

  return results;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * 複数検査を横断して未解決指摘を返す。
 */
export function getUnresolvedFindings(
  inspections: RemoteInspection[],
): InspectionFinding[] {
  return inspections.flatMap((insp) =>
    insp.findings.filter((f) => f.status === "open" || f.status === "deferred"),
  );
}

// ── Report generation ─────────────────────────────────────────────────────────

/**
 * 検査レポートを生成する。
 */
export function generateInspectionReport(
  inspection: RemoteInspection,
): RemoteInspectionReport {
  const totalPoints = inspection.route.points.length;
  const findingsCount = inspection.findings.length;
  const criticalCount = inspection.findings.filter(
    (f) => f.severity === "critical",
  ).length;
  const resolvedCount = inspection.findings.filter(
    (f) => f.status === "resolved",
  ).length;

  const progressComparisons = compareProgress(inspection.route.points);

  return {
    inspection,
    summary: {
      totalPoints,
      findingsCount,
      criticalCount,
      resolvedCount,
    },
    progressComparisons,
  };
}

// ── HTML report ───────────────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<InspectionFinding["severity"], string> = {
  critical: "重大",
  major: "重要",
  minor: "軽微",
  observation: "観察",
};

const SEVERITY_COLORS: Record<InspectionFinding["severity"], string> = {
  critical: "#dc2626",
  major: "#ea580c",
  minor: "#ca8a04",
  observation: "#2563eb",
};

const FINDING_STATUS_LABELS: Record<InspectionFinding["status"], string> = {
  open: "未解決",
  resolved: "解決済",
  deferred: "保留",
};

/**
 * 印刷可能なHTMLレポートを生成する。
 */
export function buildInspectionReportHtml(report: RemoteInspectionReport): string {
  const { inspection, summary, progressComparisons } = report;

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const scheduledDate = inspection.scheduledAt
    .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  const findingRows =
    inspection.findings.length > 0
      ? inspection.findings
          .map(
            (f, idx) =>
              `<tr${f.severity === "critical" ? ' style="background:#fef2f2;"' : ""}>
                <td style="text-align:center">${idx + 1}</td>
                <td style="font-weight:700;color:${SEVERITY_COLORS[f.severity]}">${escapeHtml(SEVERITY_LABELS[f.severity])}</td>
                <td>${escapeHtml(f.category)}</td>
                <td>${escapeHtml(f.description)}</td>
                <td style="text-align:center">${escapeHtml(FINDING_STATUS_LABELS[f.status])}</td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="5" style="text-align:center;color:#94a3b8">指摘なし</td></tr>`;

  const progressRows =
    progressComparisons.length > 0
      ? progressComparisons
          .map(
            (pc) =>
              `<tr>
                <td>${escapeHtml(pc.location)}</td>
                <td style="text-align:center">${pc.captures.length}</td>
                <td style="text-align:center;color:${pc.changeDetected ? "#16a34a" : "#94a3b8"}">${pc.changeDetected ? "あり" : "なし"}</td>
                <td>${escapeHtml(pc.progressNotes.join(" / ") || "—")}</td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">比較データなし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>リモート検査レポート - ${escapeHtml(inspection.route.name)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    h2 { font-size: 1.1em; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 18px 0 8px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; font-size: 0.9em; }
    .meta-item .label { color: #64748b; }
    .meta-item .value { font-weight: 600; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>リモート検査レポート</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">ルート: </span><span class="value">${escapeHtml(inspection.route.name)}</span></div>
    <div class="meta-item"><span class="label">検査員: </span><span class="value">${escapeHtml(inspection.inspector)}</span></div>
    <div class="meta-item"><span class="label">実施日: </span><span class="value">${scheduledDate}</span></div>
    <div class="meta-item"><span class="label">ポイント数: </span><span class="value">${summary.totalPoints}</span></div>
    <div class="meta-item"><span class="label">指摘件数: </span><span class="value">${summary.findingsCount}</span></div>
    <div class="meta-item"><span class="label">重大: </span><span class="value">${summary.criticalCount}</span></div>
    <div class="meta-item"><span class="label">解決済: </span><span class="value">${summary.resolvedCount}</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>

  <h2>指摘一覧</h2>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th style="width:60px">重要度</th>
        <th style="width:100px">カテゴリ</th>
        <th>内容</th>
        <th style="width:70px">ステータス</th>
      </tr>
    </thead>
    <tbody>
      ${findingRows}
    </tbody>
  </table>

  <h2>進捗比較</h2>
  <table>
    <thead>
      <tr>
        <th>場所</th>
        <th style="width:60px">撮影回数</th>
        <th style="width:60px">変化</th>
        <th>メモ</th>
      </tr>
    </thead>
    <tbody>
      ${progressRows}
    </tbody>
  </table>
</body>
</html>`;
}

// ── CSV export ────────────────────────────────────────────────────────────────


/**
 * 指摘一覧をCSV文字列に変換する。
 */
export function exportFindingsCSV(findings: InspectionFinding[]): string {
  const header = ["ID", "ポイントID", "重要度", "カテゴリ", "内容", "ステータス"].join(",");
  const rows = findings.map((f) =>
    [
      csvEscape(f.id),
      csvEscape(f.pointId),
      csvEscape(SEVERITY_LABELS[f.severity]),
      csvEscape(f.category),
      csvEscape(f.description),
      csvEscape(FINDING_STATUS_LABELS[f.status]),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export type InspectionStats = {
  total: number;
  byStatus: Record<RemoteInspection["status"], number>;
  totalFindings: number;
  criticalFindings: number;
  resolvedFindings: number;
  averageFindingsPerInspection: number;
};

/**
 * 複数検査の統計を集計する。
 */
export function getInspectionStats(inspections: RemoteInspection[]): InspectionStats {
  const byStatus: Record<RemoteInspection["status"], number> = {
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  let totalFindings = 0;
  let criticalFindings = 0;
  let resolvedFindings = 0;

  for (const insp of inspections) {
    byStatus[insp.status] += 1;
    totalFindings += insp.findings.length;
    criticalFindings += insp.findings.filter((f) => f.severity === "critical").length;
    resolvedFindings += insp.findings.filter((f) => f.status === "resolved").length;
  }

  return {
    total: inspections.length,
    byStatus,
    totalFindings,
    criticalFindings,
    resolvedFindings,
    averageFindingsPerInspection:
      inspections.length > 0 ? totalFindings / inspections.length : 0,
  };
}

// ── Frequency suggestion ──────────────────────────────────────────────────────

export type InspectionFrequencySuggestion = {
  frequencyDays: number;
  reason: string;
  phase: string;
};

/**
 * 工程フェーズと残日数から適切な検査頻度を提案する。
 */
export function suggestInspectionFrequency(
  projectDays: number,
  currentPhase: string,
): InspectionFrequencySuggestion {
  const phase = currentPhase.toLowerCase();

  if (phase.includes("解体") || phase.includes("demolition")) {
    return { frequencyDays: 3, reason: "解体工事は危険箇所が多く頻繁な確認が必要", phase: currentPhase };
  }
  if (phase.includes("基礎") || phase.includes("foundation") || phase.includes("躯体") || phase.includes("structure")) {
    return { frequencyDays: 5, reason: "躯体・基礎工事は品質クリティカルな工程", phase: currentPhase };
  }
  if (phase.includes("仕上") || phase.includes("finish") || phase.includes("内装") || phase.includes("interior")) {
    return { frequencyDays: 7, reason: "仕上工程は週次チェックで品質管理", phase: currentPhase };
  }
  if (phase.includes("設備") || phase.includes("mechanical") || phase.includes("electrical")) {
    return { frequencyDays: 7, reason: "設備工事は週次で進捗確認", phase: currentPhase };
  }
  if (phase.includes("竣工") || phase.includes("closeout") || phase.includes("punch")) {
    return { frequencyDays: 2, reason: "竣工前は集中的な検査が必要", phase: currentPhase };
  }

  // Fallback based on remaining project days
  if (projectDays <= 14) {
    return { frequencyDays: 2, reason: "工期終盤のため高頻度チェックを推奨", phase: currentPhase };
  }
  if (projectDays <= 30) {
    return { frequencyDays: 5, reason: "工期残少のため頻度を上げることを推奨", phase: currentPhase };
  }
  return { frequencyDays: 10, reason: "標準工程につき10日ごとの確認を推奨", phase: currentPhase };
}
