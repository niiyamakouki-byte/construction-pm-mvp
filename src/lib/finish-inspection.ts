/**
 * 仕上検査モジュール — ANDPAD/SPIDERPLUS蒸留
 * 部屋単位の仕上検査管理。図面ピン・是正ワークフローと連携。
 */
import { escapeHtml } from "./utils/escape-html";

// ── 内装特化カテゴリ ──────────────────────────────────────────────────────────

export type FinishCategory =
  | "天井仕上"
  | "壁仕上"
  | "床仕上"
  | "巾木"
  | "廻り縁"
  | "建具"
  | "金物"
  | "クロス"
  | "塗装"
  | "設備"
  | "その他";

export const FINISH_CATEGORIES: FinishCategory[] = [
  "天井仕上",
  "壁仕上",
  "床仕上",
  "巾木",
  "廻り縁",
  "建具",
  "金物",
  "クロス",
  "塗装",
  "設備",
  "その他",
];

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type InspectionItemStatus = "ok" | "ng" | "na";

export type FinishInspectionItem = {
  id: string;
  category: FinishCategory;
  description: string;
  status: InspectionItemStatus;
  pinId?: string;       // DrawingPin との連携
  correctionId?: string; // 是正ワークフローとの連携
  photos: string[];
  comment: string;
};

export type RoomInspectionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "approved";

export type RoomInspection = {
  id: string;
  projectId: string;
  roomName: string;
  floor: string;
  inspectionDate: string; // YYYY-MM-DD
  inspector: string;
  status: RoomInspectionStatus;
  items: FinishInspectionItem[];
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
};

export type InspectionProgress = {
  roomId: string;
  roomName: string;
  floor: string;
  ok: number;
  ng: number;
  na: number;
  total: number;
  ngRate: number; // NG件数 / (OK+NG件数)
};

export type ProjectInspectionSummary = {
  projectId: string;
  totalRooms: number;
  completedRooms: number;
  approvedRooms: number;
  rooms: InspectionProgress[];
  totalOk: number;
  totalNg: number;
  totalNa: number;
};

// ── In-memory store ──────────────────────────────────────────────────────────

const inspections = new Map<string, RoomInspection>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}


function findOrThrow(id: string): RoomInspection {
  const item = inspections.get(id);
  if (!item) throw new Error(`RoomInspection ${id} not found`);
  return item;
}

// ── ステータス遷移定義 ────────────────────────────────────────────────────────

const VALID_ROOM_TRANSITIONS: Record<RoomInspectionStatus, RoomInspectionStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["completed", "not_started"],
  completed: ["approved", "in_progress"],
  approved: [],
};

function assertValidRoomTransition(
  current: RoomInspectionStatus,
  next: RoomInspectionStatus,
): void {
  if (!VALID_ROOM_TRANSITIONS[current].includes(next)) {
    throw new Error(`ステータス遷移不可: ${current} → ${next}`);
  }
}

// ── テスト用リセット ──────────────────────────────────────────────────────────

/**
 * テスト用: 全データをリセットする。
 */
export function clearInspections(): void {
  inspections.clear();
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * 部屋検査を新規登録する。初期ステータスは "not_started"。
 */
export function createRoomInspection(
  params: Omit<RoomInspection, "id" | "status" | "items" | "createdAt" | "updatedAt">,
): RoomInspection {
  const id = crypto.randomUUID();
  const item: RoomInspection = {
    ...params,
    id,
    status: "not_started",
    items: [],
    createdAt: now(),
    updatedAt: now(),
  };
  inspections.set(id, { ...item, items: [] });
  return { ...item };
}

/**
 * 検査項目を追加する。
 */
export function addInspectionItem(
  inspectionId: string,
  params: Omit<FinishInspectionItem, "id">,
): RoomInspection {
  const inspection = findOrThrow(inspectionId);
  const newItem: FinishInspectionItem = {
    ...params,
    id: crypto.randomUUID(),
  };
  const updated: RoomInspection = {
    ...inspection,
    items: [...inspection.items, newItem],
    status: inspection.status === "not_started" ? "in_progress" : inspection.status,
    updatedAt: now(),
  };
  inspections.set(inspectionId, { ...updated, items: [...updated.items] });
  return { ...updated, items: [...updated.items] };
}

/**
 * 検査項目のステータスを更新する。
 */
export function updateItemStatus(
  inspectionId: string,
  itemId: string,
  status: InspectionItemStatus,
  comment?: string,
): RoomInspection {
  const inspection = findOrThrow(inspectionId);
  const items = inspection.items.map((item) =>
    item.id === itemId
      ? { ...item, status, ...(comment !== undefined ? { comment } : {}) }
      : item,
  );
  if (!inspection.items.some((i) => i.id === itemId)) {
    throw new Error(`FinishInspectionItem ${itemId} not found`);
  }
  const updated: RoomInspection = { ...inspection, items, updatedAt: now() };
  inspections.set(inspectionId, { ...updated, items: [...updated.items] });
  return { ...updated, items: [...updated.items] };
}

/**
 * 検査を完了にする（in_progress → completed）。
 */
export function completeInspection(id: string): RoomInspection {
  const inspection = findOrThrow(id);
  assertValidRoomTransition(inspection.status, "completed");
  const updated: RoomInspection = {
    ...inspection,
    status: "completed",
    updatedAt: now(),
  };
  inspections.set(id, { ...updated, items: [...updated.items] });
  return { ...updated, items: [...updated.items] };
}

/**
 * 検査を承認する（completed → approved）。
 */
export function approveInspection(id: string): RoomInspection {
  const inspection = findOrThrow(id);
  assertValidRoomTransition(inspection.status, "approved");
  const updated: RoomInspection = {
    ...inspection,
    status: "approved",
    updatedAt: now(),
  };
  inspections.set(id, { ...updated, items: [...updated.items] });
  return { ...updated, items: [...updated.items] };
}

/**
 * プロジェクトの検査一覧を取得する。
 */
export function getInspectionsByProject(projectId: string): RoomInspection[] {
  return [...inspections.values()].filter((i) => i.projectId === projectId);
}

// ── 集計 ─────────────────────────────────────────────────────────────────────

/**
 * 部屋ごとのOK/NG/NA件数と進捗を集計する。
 */
export function getInspectionProgress(inspection: RoomInspection): InspectionProgress {
  const ok = inspection.items.filter((i) => i.status === "ok").length;
  const ng = inspection.items.filter((i) => i.status === "ng").length;
  const na = inspection.items.filter((i) => i.status === "na").length;
  const graded = ok + ng;
  const ngRate = graded > 0 ? ng / graded : 0;

  return {
    roomId: inspection.id,
    roomName: inspection.roomName,
    floor: inspection.floor,
    ok,
    ng,
    na,
    total: inspection.items.length,
    ngRate,
  };
}

/**
 * プロジェクト全体の仕上検査サマリーを取得する。
 */
export function getProjectInspectionSummary(projectId: string): ProjectInspectionSummary {
  const rooms = getInspectionsByProject(projectId);
  const progresses = rooms.map((r) => getInspectionProgress(r));

  const completedRooms = rooms.filter(
    (r) => r.status === "completed" || r.status === "approved",
  ).length;
  const approvedRooms = rooms.filter((r) => r.status === "approved").length;

  const totalOk = progresses.reduce((sum, p) => sum + p.ok, 0);
  const totalNg = progresses.reduce((sum, p) => sum + p.ng, 0);
  const totalNa = progresses.reduce((sum, p) => sum + p.na, 0);

  return {
    projectId,
    totalRooms: rooms.length,
    completedRooms,
    approvedRooms,
    rooms: progresses,
    totalOk,
    totalNg,
    totalNa,
  };
}

// ── 検査テンプレート ──────────────────────────────────────────────────────────

export type TemplateItem = {
  category: FinishCategory;
  description: string;
  checkPoints: string[];
};

export type InspectionTemplate = {
  name: string;
  category: string;
  items: TemplateItem[];
};

export const INTERIOR_INSPECTION_TEMPLATES: InspectionTemplate[] = [
  {
    name: "クロス仕上げ検査",
    category: "クロス",
    items: [
      {
        category: "クロス",
        description: "浮き・剥がれ",
        checkPoints: ["全面を手で押さえて浮きを確認", "端部・継ぎ目の剥がれを確認"],
      },
      {
        category: "クロス",
        description: "ジョイント処理",
        checkPoints: ["ジョイント部の隙間がないこと", "重なりが均一であること"],
      },
      {
        category: "クロス",
        description: "パテ跡",
        checkPoints: ["パテ跡が透けて見えないこと", "凹凸がないこと"],
      },
      {
        category: "クロス",
        description: "コーナー処理",
        checkPoints: ["コーナー部が直角に仕上がっていること", "シワ・ヨレがないこと"],
      },
      {
        category: "壁仕上",
        description: "出隅・入隅",
        checkPoints: ["出隅の角が均一であること", "入隅の隙間がないこと"],
      },
      {
        category: "設備",
        description: "スイッチ・コンセント廻り",
        checkPoints: ["プレート廻りに隙間がないこと", "切り込みが正確であること"],
      },
    ],
  },
  {
    name: "塗装仕上げ検査",
    category: "塗装",
    items: [
      {
        category: "塗装",
        description: "ムラ・タレ",
        checkPoints: ["光の角度を変えてムラを確認", "タレ跡がないこと"],
      },
      {
        category: "塗装",
        description: "ハケ目",
        checkPoints: ["ハケ目が残っていないこと", "ローラー跡が均一であること"],
      },
      {
        category: "塗装",
        description: "見切り処理",
        checkPoints: ["見切り線が直線であること", "はみ出しがないこと"],
      },
      {
        category: "塗装",
        description: "養生跡",
        checkPoints: ["養生テープの糊残りがないこと", "周囲の汚れがないこと"],
      },
      {
        category: "塗装",
        description: "色合い",
        checkPoints: ["指定色と一致していること", "面内で色ムラがないこと"],
      },
      {
        category: "塗装",
        description: "塗膜厚",
        checkPoints: ["規定の塗り回数が守られていること", "下地が透けて見えないこと"],
      },
    ],
  },
  {
    name: "床仕上げ検査",
    category: "床仕上",
    items: [
      {
        category: "床仕上",
        description: "レベル確認",
        checkPoints: ["水平器で水平を確認", "踏んで沈みがないこと"],
      },
      {
        category: "床仕上",
        description: "ジョイント処理",
        checkPoints: ["ジョイント部の隙間がないこと", "段差がないこと"],
      },
      {
        category: "巾木",
        description: "巾木取付",
        checkPoints: ["巾木が密着していること", "コーナー部の合わせが正確であること"],
      },
      {
        category: "床仕上",
        description: "CF巻き上げ",
        checkPoints: ["巻き上げ高さが均一であること", "剥がれがないこと"],
      },
      {
        category: "床仕上",
        description: "フローリング隙間",
        checkPoints: ["フローリング間の隙間が均一であること", "反りがないこと"],
      },
      {
        category: "床仕上",
        description: "タイル目地",
        checkPoints: ["目地幅が均一であること", "目地材の充填が十分であること"],
      },
    ],
  },
];

/**
 * テンプレートから部屋検査を自動生成する。
 */
export function createInspectionFromTemplate(
  projectId: string,
  roomName: string,
  templateName: string,
): RoomInspection {
  const template = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === templateName);
  if (!template) {
    throw new Error(`InspectionTemplate "${templateName}" not found`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const inspection = createRoomInspection({
    projectId,
    roomName,
    floor: "",
    inspectionDate: today,
    inspector: "",
  });

  let current = inspection;
  for (const templateItem of template.items) {
    current = addInspectionItem(current.id, {
      category: templateItem.category,
      description: `${templateItem.description}（${templateItem.checkPoints.join(" / ")}）`,
      status: "na",
      photos: [],
      comment: "",
    });
  }

  return current;
}

// ── 帳票 ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RoomInspectionStatus, string> = {
  not_started: "未着手",
  in_progress: "検査中",
  completed: "完了",
  approved: "承認済",
};

const STATUS_COLORS: Record<RoomInspectionStatus, string> = {
  not_started: "#94a3b8",
  in_progress: "#f59e0b",
  completed: "#3b82f6",
  approved: "#22c55e",
};

const ITEM_STATUS_LABELS: Record<InspectionItemStatus, string> = {
  ok: "OK",
  ng: "NG",
  na: "—",
};

const ITEM_STATUS_COLORS: Record<InspectionItemStatus, string> = {
  ok: "#22c55e",
  ng: "#ef4444",
  na: "#94a3b8",
};

/**
 * 部屋別の検査結果一覧HTML帳票を生成する。
 * correction-workflow.ts の buildCorrectionReportHtml と同スタイル。
 */
export function buildFinishInspectionHtml(
  projectId: string,
  projectName: string,
): string {
  const rooms = getInspectionsByProject(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const summary = getProjectInspectionSummary(projectId);

  const roomSections =
    rooms.length > 0
      ? rooms
          .map((room) => {
            const progress = getInspectionProgress(room);
            const itemRows =
              room.items.length > 0
                ? room.items
                    .map(
                      (item, idx) =>
                        `<tr${item.status === "ng" ? ' style="background:#fef2f2;"' : ""}>
                          <td style="text-align:center">${idx + 1}</td>
                          <td>${escapeHtml(item.category)}</td>
                          <td>${escapeHtml(item.description)}</td>
                          <td style="text-align:center;font-weight:700;color:${ITEM_STATUS_COLORS[item.status]}">${ITEM_STATUS_LABELS[item.status]}</td>
                          <td>${escapeHtml(item.comment || "—")}</td>
                        </tr>`,
                    )
                    .join("\n")
                : `<tr><td colspan="5" style="text-align:center;color:#94a3b8">検査項目なし</td></tr>`;

            return `<section style="margin-bottom:28px;">
  <h2 style="font-size:1.1em;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;">
    ${escapeHtml(room.floor)} / ${escapeHtml(room.roomName)}
    <span style="margin-left:12px;font-size:0.85em;font-weight:700;color:${STATUS_COLORS[room.status]}">${STATUS_LABELS[room.status]}</span>
  </h2>
  <div style="font-size:0.85em;margin-bottom:8px;color:#64748b;">
    検査員: ${escapeHtml(room.inspector)} ／ 検査日: ${escapeHtml(room.inspectionDate)} ／
    OK: ${progress.ok}件 NG: ${progress.ng}件 NA: ${progress.na}件
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th style="width:100px">カテゴリ</th>
        <th>内容</th>
        <th style="width:60px">結果</th>
        <th>コメント</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
</section>`;
          })
          .join("\n")
      : `<p style="color:#94a3b8">検査データなし</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>仕上検査一覧 - ${escapeHtml(projectName)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
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
  <h1>仕上検査一覧</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">部屋数: </span><span class="value">${summary.totalRooms}室</span></div>
    <div class="meta-item"><span class="label">完了: </span><span class="value">${summary.completedRooms}室</span></div>
    <div class="meta-item"><span class="label">NG: </span><span class="value">${summary.totalNg}件</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  ${roomSections}
</body>
</html>`;
}
