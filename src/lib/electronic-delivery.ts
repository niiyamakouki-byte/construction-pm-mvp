/**
 * Electronic Delivery — 電子納品（CALS/EC）出力機能
 *
 * 国土交通省 CALS/EC v4.0 電子納品標準に準拠した納品パッケージを生成する。
 * ANDPAD蒸留: 公共工事で必須の電子納品フォルダ構成・INDEX_D.XML対応。
 */

// ── 定数 ────────────────────────────────────────────────────────────────────

/** CALS/EC 標準フォルダ構成 */
export const CALS_FOLDER_STRUCTURE = {
  PHOTO: "写真フォルダ",
  DRAWING: "図面フォルダ",
  BORING: "地盤調査・試験フォルダ",
  MEET: "打合せ簿フォルダ",
  PLAN: "施工計画書フォルダ",
  OTHRS: "その他フォルダ",
} as const;

export type CalsFolderName = keyof typeof CALS_FOLDER_STRUCTURE;

// ── Data types ───────────────────────────────────────────────────────────────

export type DeliveryFile = {
  originalName: string;
  deliveryName: string;    // 規定のファイル名形式 (例: PH000001.JPG)
  category: string;        // 工種・区分
  metadata: Record<string, string>;
};

export type DeliveryFolder = {
  name: CalsFolderName;
  files: DeliveryFile[];
};

export type DeliveryPackage = {
  id: string;
  projectId: string;
  projectName: string;
  standardVersion: "CALS/EC v4.0";
  createdAt: string;       // ISO datetime
  folders: DeliveryFolder[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `ED-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 規定ファイル名を生成する。
 * 写真: PH000001.JPG、図面: DR000001.DWG 等、フォルダプレフィックス+6桁連番
 */
function buildDeliveryFileName(
  folder: CalsFolderName,
  index: number,
  originalName: string,
): string {
  const prefixes: Record<CalsFolderName, string> = {
    PHOTO: "PH",
    DRAWING: "DR",
    BORING: "BG",
    MEET: "MT",
    PLAN: "PL",
    OTHRS: "OT",
  };
  const ext = originalName.includes(".")
    ? originalName.split(".").pop()!.toUpperCase()
    : "DAT";
  const seq = String(index + 1).padStart(6, "0");
  return `${prefixes[folder]}${seq}.${ext}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * プロジェクトの写真・図面・検査データから電子納品パッケージを生成する。
 */
export function createDeliveryPackage(
  projectId: string,
  options: {
    projectName: string;
    photos?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    drawings?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    borings?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    meetings?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    plans?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    others?: Array<{ originalName: string; category: string; metadata?: Record<string, string> }>;
    createdAt?: string;
  },
): DeliveryPackage {
  const {
    projectName,
    photos = [],
    drawings = [],
    borings = [],
    meetings = [],
    plans = [],
    others = [],
    createdAt = new Date().toISOString(),
  } = options;

  const folderMap: Array<[CalsFolderName, typeof photos]> = [
    ["PHOTO", photos],
    ["DRAWING", drawings],
    ["BORING", borings],
    ["MEET", meetings],
    ["PLAN", plans],
    ["OTHRS", others],
  ];

  const folders: DeliveryFolder[] = folderMap
    .filter(([, items]) => items.length > 0)
    .map(([folderName, items]) => ({
      name: folderName,
      files: items.map((item, idx) => ({
        originalName: item.originalName,
        deliveryName: buildDeliveryFileName(folderName, idx, item.originalName),
        category: item.category,
        metadata: item.metadata ?? {},
      })),
    }));

  return {
    id: generateId(),
    projectId,
    projectName,
    standardVersion: "CALS/EC v4.0",
    createdAt,
    folders,
  };
}

/**
 * ファイル一覧XML（INDEX_D.XML形式）を生成する。
 * 国土交通省 CALS/EC 電子納品要領 付属資料 準拠。
 */
export function generateDeliveryFileList(pkg: DeliveryPackage): string {
  const folderElements = pkg.folders
    .map((folder) => {
      const fileElements = folder.files
        .map(
          (f) =>
            `    <FILE>\n` +
            `      <ORIGINAL_NAME>${escapeXml(f.originalName)}</ORIGINAL_NAME>\n` +
            `      <DELIVERY_NAME>${escapeXml(f.deliveryName)}</DELIVERY_NAME>\n` +
            `      <CATEGORY>${escapeXml(f.category)}</CATEGORY>\n` +
            Object.entries(f.metadata)
              .map(([k, v]) => `      <${escapeXml(k)}>${escapeXml(v)}</${escapeXml(k)}>`)
              .join("\n") +
            (Object.keys(f.metadata).length > 0 ? "\n" : "") +
            `    </FILE>`,
        )
        .join("\n");

      return (
        `  <FOLDER name="${escapeXml(folder.name)}" label="${escapeXml(CALS_FOLDER_STRUCTURE[folder.name])}">\n` +
        fileElements +
        `\n  </FOLDER>`
      );
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<INDEX_D version="4.0">\n` +
    `  <PROJECT_ID>${escapeXml(pkg.projectId)}</PROJECT_ID>\n` +
    `  <PROJECT_NAME>${escapeXml(pkg.projectName)}</PROJECT_NAME>\n` +
    `  <STANDARD_VERSION>${escapeXml(pkg.standardVersion)}</STANDARD_VERSION>\n` +
    `  <CREATED_AT>${escapeXml(pkg.createdAt)}</CREATED_AT>\n` +
    folderElements +
    `\n</INDEX_D>`
  );
}

/**
 * CALS/EC 規格への準拠チェックを実行する。
 */
export function validatePackage(pkg: DeliveryPackage): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必須フィールドチェック
  if (!pkg.projectId) errors.push("projectId が未設定です");
  if (!pkg.projectName) errors.push("projectName が未設定です");
  if (pkg.standardVersion !== "CALS/EC v4.0") {
    errors.push(`standardVersion は "CALS/EC v4.0" である必要があります (現在: ${pkg.standardVersion})`);
  }
  if (!pkg.createdAt || !/^\d{4}-\d{2}-\d{2}T/.test(pkg.createdAt)) {
    errors.push("createdAt が ISO 8601 形式ではありません");
  }

  // フォルダ・ファイルチェック
  if (pkg.folders.length === 0) {
    warnings.push("納品フォルダが空です");
  }

  const validFolderNames = Object.keys(CALS_FOLDER_STRUCTURE) as CalsFolderName[];
  const seenFolders = new Set<string>();

  for (const folder of pkg.folders) {
    if (!validFolderNames.includes(folder.name)) {
      errors.push(`不正なフォルダ名です: ${folder.name}`);
    }
    if (seenFolders.has(folder.name)) {
      errors.push(`フォルダ名が重複しています: ${folder.name}`);
    }
    seenFolders.add(folder.name);

    const seenDeliveryNames = new Set<string>();
    for (const file of folder.files) {
      if (!file.originalName) {
        errors.push(`${folder.name}: originalName が未設定のファイルがあります`);
      }
      if (!file.deliveryName) {
        errors.push(`${folder.name}: deliveryName が未設定のファイルがあります`);
      }
      // CALS規定ファイル名: 英数字8文字以内+拡張子
      if (!/^[A-Z0-9]{2}\d{6}\.[A-Z0-9]{1,4}$/.test(file.deliveryName)) {
        errors.push(
          `${folder.name}/${file.deliveryName}: ファイル名がCALS/EC規定形式（英字2文字+6桁数字.拡張子）に準拠していません`,
        );
      }
      if (seenDeliveryNames.has(file.deliveryName)) {
        errors.push(`${folder.name}: 納品ファイル名が重複しています: ${file.deliveryName}`);
      }
      seenDeliveryNames.add(file.deliveryName);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 納品物一覧HTMLを生成する。印刷・PDF変換は window.print() で対応。
 */
export function buildDeliveryIndexHtml(pkg: DeliveryPackage): string {
  const folderRows = pkg.folders
    .map((folder) => {
      const fileRows = folder.files
        .map(
          (f) =>
            `      <tr>\n` +
            `        <td>${escapeHtml(folder.name)}</td>\n` +
            `        <td>${escapeHtml(f.deliveryName)}</td>\n` +
            `        <td>${escapeHtml(f.originalName)}</td>\n` +
            `        <td>${escapeHtml(f.category)}</td>\n` +
            `      </tr>`,
        )
        .join("\n");
      return fileRows;
    })
    .join("\n");

  const totalFiles = pkg.folders.reduce((sum, f) => sum + f.files.length, 0);
  const createdAtDisplay = pkg.createdAt.slice(0, 10);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pkg.projectName)} — 電子納品 納品物一覧</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Hiragino Sans", "Yu Gothic", "MS Gothic", sans-serif;
      margin: 0;
      padding: 24px;
      color: #222;
      font-size: 13px;
    }
    h1 { font-size: 1.4em; margin-bottom: 4px; }
    .meta { color: #64748b; margin-bottom: 16px; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; }
    th {
      background: #1e293b;
      color: #fff;
      padding: 8px 10px;
      text-align: left;
    }
    td { border: 1px solid #cbd5e1; padding: 6px 10px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 16px; color: #94a3b8; font-size: 0.8em; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(pkg.projectName)} — 電子納品 納品物一覧</h1>
  <div class="meta">
    規格: ${escapeHtml(pkg.standardVersion)} &nbsp;|&nbsp;
    作成日: ${escapeHtml(createdAtDisplay)} &nbsp;|&nbsp;
    ファイル数: ${totalFiles}件
  </div>
  <table>
    <thead>
      <tr>
        <th>フォルダ</th>
        <th>納品ファイル名</th>
        <th>原ファイル名</th>
        <th>区分</th>
      </tr>
    </thead>
    <tbody>
${folderRows}
    </tbody>
  </table>
  <div class="footer">
    国土交通省 CALS/EC 電子納品 — INDEX_D.XML 対応 | GenbaHub
  </div>
</body>
</html>`;
}
