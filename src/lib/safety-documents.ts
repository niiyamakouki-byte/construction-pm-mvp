/**
 * Safety Documents module for GenbaHub.
 * Buildee蒸留: 作業員名簿・新規入場者教育・工事安全衛生計画書・作業手順書・有資格者一覧
 */

export type SafetyDocumentType =
  | "作業員名簿"
  | "新規入場者教育"
  | "工事安全衛生計画書"
  | "作業手順書"
  | "有資格者一覧";

// ── Field types ───────────────────────────────────────────────────────────────

export type WorkerRecord = {
  name: string;
  company: string;
  role: string;
  birthDate: string;
  address: string;
  emergencyContact: string;
  bloodType: string;
  joinDate: string;
};

export type NewEntryEducationRecord = {
  workerName: string;
  company: string;
  date: string;
  instructor: string;
  topics: string[];
  signatureConfirmed: boolean;
};

export type SafetyPlanRecord = {
  projectName: string;
  projectManager: string;
  safetyOfficer: string;
  startDate: string;
  endDate: string;
  objectives: string[];
  measures: string[];
  emergencyProcedure: string;
};

export type WorkProcedureRecord = {
  workTitle: string;
  author: string;
  date: string;
  steps: { stepNo: number; description: string; hazards: string; countermeasures: string }[];
  approvedBy: string;
};

export type QualifiedWorkerRecord = {
  name: string;
  company: string;
  qualification: string;
  licenseNumber: string;
  issueDate: string;
  expiryDate: string;
};

export type SafetyDocumentData =
  | { type: "作業員名簿"; workers: WorkerRecord[] }
  | { type: "新規入場者教育"; records: NewEntryEducationRecord[] }
  | { type: "工事安全衛生計画書"; plan: SafetyPlanRecord }
  | { type: "作業手順書"; procedures: WorkProcedureRecord[] }
  | { type: "有資格者一覧"; workers: QualifiedWorkerRecord[] };

export type SafetyDocument = {
  id: string;
  projectId: string;
  type: SafetyDocumentType;
  title: string;
  data: SafetyDocumentData;
  createdAt: string;
  updatedAt: string;
};

// ── In-memory store ───────────────────────────────────────────────────────────

const documents: SafetyDocument[] = [];

function newId(): string {
  return `sdoc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Template defaults ─────────────────────────────────────────────────────────

export const DOCUMENT_TEMPLATE_DATA: Record<SafetyDocumentType, SafetyDocumentData> = {
  作業員名簿: {
    type: "作業員名簿",
    workers: [
      {
        name: "",
        company: "",
        role: "",
        birthDate: "",
        address: "",
        emergencyContact: "",
        bloodType: "",
        joinDate: new Date().toISOString().slice(0, 10),
      },
    ],
  },
  新規入場者教育: {
    type: "新規入場者教育",
    records: [
      {
        workerName: "",
        company: "",
        date: new Date().toISOString().slice(0, 10),
        instructor: "",
        topics: [
          "現場ルール説明",
          "緊急時の連絡体制",
          "保護具の着用義務",
          "作業エリアの確認",
          "危険箇所の周知",
        ],
        signatureConfirmed: false,
      },
    ],
  },
  工事安全衛生計画書: {
    type: "工事安全衛生計画書",
    plan: {
      projectName: "",
      projectManager: "",
      safetyOfficer: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      objectives: ["無事故・無災害の達成", "作業員の安全衛生の確保", "法令遵守"],
      measures: [
        "毎朝KY活動の実施",
        "保護具の着用徹底",
        "作業前点検の実施",
        "整理整頓の徹底",
        "定期安全パトロールの実施",
      ],
      emergencyProcedure: "事故発生時は直ちに作業中止し、現場責任者へ連絡。必要に応じ119番通報。",
    },
  },
  作業手順書: {
    type: "作業手順書",
    procedures: [
      {
        workTitle: "",
        author: "",
        date: new Date().toISOString().slice(0, 10),
        steps: [
          { stepNo: 1, description: "準備・確認", hazards: "", countermeasures: "" },
          { stepNo: 2, description: "作業実施", hazards: "", countermeasures: "" },
          { stepNo: 3, description: "後片付け・点検", hazards: "", countermeasures: "" },
        ],
        approvedBy: "",
      },
    ],
  },
  有資格者一覧: {
    type: "有資格者一覧",
    workers: [
      {
        name: "",
        company: "",
        qualification: "",
        licenseNumber: "",
        issueDate: "",
        expiryDate: "",
      },
    ],
  },
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listDocuments(projectId?: string): SafetyDocument[] {
  const list = projectId ? documents.filter((d) => d.projectId === projectId) : [...documents];
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDocument(id: string): SafetyDocument | undefined {
  return documents.find((d) => d.id === id);
}

export function createDocument(
  entry: Omit<SafetyDocument, "id" | "createdAt" | "updatedAt">,
): SafetyDocument {
  const now = new Date().toISOString();
  const doc: SafetyDocument = {
    ...entry,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  documents.push(doc);
  return doc;
}

export function updateDocument(
  id: string,
  patch: Partial<Pick<SafetyDocument, "title" | "data">>,
): SafetyDocument | undefined {
  const idx = documents.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  documents[idx] = { ...documents[idx], ...patch, updatedAt: new Date().toISOString() };
  return documents[idx];
}

export function deleteDocument(id: string): boolean {
  const idx = documents.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  documents.splice(idx, 1);
  return true;
}

/**
 * Buildee蒸留: 他プロジェクトからテンプレートコピー
 * 同一書類typeのデータを別プロジェクトに複製する
 */
export function copyDocumentToProject(
  sourceId: string,
  targetProjectId: string,
): SafetyDocument | undefined {
  const source = getDocument(sourceId);
  if (!source) return undefined;
  return createDocument({
    projectId: targetProjectId,
    type: source.type,
    title: `${source.title} (コピー)`,
    data: JSON.parse(JSON.stringify(source.data)) as SafetyDocumentData,
  });
}

/**
 * テンプレートから新規書類を作成
 */
export function createFromTemplate(
  projectId: string,
  type: SafetyDocumentType,
): SafetyDocument {
  const templateData = JSON.parse(
    JSON.stringify(DOCUMENT_TEMPLATE_DATA[type]),
  ) as SafetyDocumentData;
  return createDocument({ projectId, type, title: type, data: templateData });
}

// ── PDF data generation ───────────────────────────────────────────────────────

/**
 * PDF出力用のHTML文字列を生成
 */
export function generateDocumentHtml(doc: SafetyDocument): string {
  const now = new Date().toLocaleDateString("ja-JP");
  let body = "";

  if (doc.data.type === "作業員名簿") {
    const rows = doc.data.workers
      .map(
        (w) =>
          `<tr><td>${e(w.name)}</td><td>${e(w.company)}</td><td>${e(w.role)}</td><td>${e(w.joinDate)}</td><td>${e(w.emergencyContact)}</td></tr>`,
      )
      .join("");
    body = `<table><thead><tr><th>氏名</th><th>会社</th><th>役職</th><th>入場日</th><th>緊急連絡先</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if (doc.data.type === "新規入場者教育") {
    const rows = doc.data.records
      .map(
        (r) =>
          `<tr><td>${e(r.workerName)}</td><td>${e(r.company)}</td><td>${e(r.date)}</td><td>${e(r.instructor)}</td><td>${r.signatureConfirmed ? "確認済" : "未確認"}</td></tr>`,
      )
      .join("");
    body = `<table><thead><tr><th>氏名</th><th>会社</th><th>日付</th><th>指導者</th><th>署名</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if (doc.data.type === "工事安全衛生計画書") {
    const p = doc.data.plan;
    body = `
      <table>
        <tr><th>工事名</th><td>${e(p.projectName)}</td></tr>
        <tr><th>現場責任者</th><td>${e(p.projectManager)}</td></tr>
        <tr><th>安全衛生担当</th><td>${e(p.safetyOfficer)}</td></tr>
        <tr><th>工期</th><td>${e(p.startDate)} ～ ${e(p.endDate)}</td></tr>
      </table>
      <h3>安全目標</h3><ul>${p.objectives.map((o) => `<li>${e(o)}</li>`).join("")}</ul>
      <h3>安全対策</h3><ul>${p.measures.map((m) => `<li>${e(m)}</li>`).join("")}</ul>
      <h3>緊急時対応</h3><p>${e(p.emergencyProcedure)}</p>`;
  } else if (doc.data.type === "作業手順書") {
    const rows = doc.data.procedures.flatMap((proc) =>
      proc.steps.map(
        (s) =>
          `<tr><td>${e(proc.workTitle)}</td><td>${s.stepNo}</td><td>${e(s.description)}</td><td>${e(s.hazards)}</td><td>${e(s.countermeasures)}</td></tr>`,
      ),
    ).join("");
    body = `<table><thead><tr><th>作業名</th><th>手順</th><th>内容</th><th>危険要因</th><th>対策</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if (doc.data.type === "有資格者一覧") {
    const rows = doc.data.workers
      .map(
        (w) =>
          `<tr><td>${e(w.name)}</td><td>${e(w.company)}</td><td>${e(w.qualification)}</td><td>${e(w.licenseNumber)}</td><td>${e(w.issueDate)}</td><td>${e(w.expiryDate)}</td></tr>`,
      )
      .join("");
    body = `<table><thead><tr><th>氏名</th><th>会社</th><th>資格名</th><th>免許番号</th><th>交付日</th><th>有効期限</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${e(doc.title)}</title>
<style>
body{font-family:'Noto Sans JP',Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1f2937;}
h1{font-size:20px;border-bottom:2px solid #1f2937;padding-bottom:8px;}
h3{font-size:14px;margin-top:16px;}
table{width:100%;border-collapse:collapse;margin:12px 0;}
th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:left;font-size:12px;}
th{background:#1f2937;color:white;}
@media print{body{padding:0;}}
</style>
</head>
<body>
<h1>${e(doc.title)}</h1>
<p style="font-size:12px;color:#6b7280;">出力日: ${now} / プロジェクトID: ${e(doc.projectId)}</p>
${body}
<footer style="margin-top:24px;font-size:11px;color:#6b7280;">Generated by GenbaHub Safety Documents Module</footer>
</body>
</html>`;
}

function e(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clearAllDocuments(): void {
  documents.length = 0;
}
