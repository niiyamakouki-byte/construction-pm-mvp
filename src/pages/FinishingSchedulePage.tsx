/**
 * FinishingSchedulePage — 仕上表モジュール（Sprint 3-5）
 * シンプル路線: 装飾削減・アクセント1色(#7BA88A)・アニメ150ms
 */

import { useCallback, useMemo, useRef, useState } from "react";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type RoomPart = "床材" | "壁材" | "天井材" | "巾木" | "建具" | "備考";

export const PARTS: RoomPart[] = ["床材", "壁材", "天井材", "巾木", "建具", "備考"];

export interface CellValue {
  name: string;
  code: string;
  color: string;
}

export type RowData = {
  id: string;
  roomName: string;
  cells: Record<RoomPart, CellValue>;
};

export type TemplateName = "ナチュラル系" | "モノトーン系" | "和モダン系";

// ── mock cost-master 候補 ─────────────────────────────────────────────────────

interface MaterialCandidate {
  name: string;
  code: string;
  color: string;
}

const MATERIAL_CANDIDATES: Record<RoomPart, MaterialCandidate[]> = {
  床材: [
    { name: "オーク突板フローリング", code: "SF-OAK-15", color: "ナチュラルブラウン" },
    { name: "ビニル床タイル", code: "SF-VCT-01", color: "ライトグレー" },
    { name: "畳(琉球)", code: "SF-TAT-RYU", color: "グリーン" },
    { name: "テラコッタタイル", code: "SF-TER-01", color: "オレンジベージュ" },
    { name: "コンクリート研磨", code: "SF-CON-PL", color: "グレー" },
    { name: "カーペット(低発泡)", code: "SF-CAR-01", color: "ベージュ" },
  ],
  壁材: [
    { name: "量産クロス白系", code: "IN-WP-SB01", color: "オフホワイト" },
    { name: "珪藻土塗り壁", code: "PT-KST-01", color: "アイボリー" },
    { name: "木板張り(ヒノキ)", code: "IN-WD-HNK", color: "ナチュラル" },
    { name: "タイル(サブウェイ)", code: "SF-TIL-SW", color: "ホワイト" },
    { name: "AEP塗装", code: "PT-AEP-WH", color: "マットホワイト" },
    { name: "石膏ボード素地", code: "IN-GB-RAW", color: "グレーホワイト" },
  ],
  天井材: [
    { name: "PB12.5 AEP仕上", code: "IN-CLG-AEP", color: "マットホワイト" },
    { name: "木毛板", code: "IN-CLG-WW", color: "ナチュラル" },
    { name: "岩綿吸音板", code: "IN-CLG-RAW", color: "ライトグレー" },
    { name: "化粧合板張り", code: "IN-CLG-PLY", color: "ウォールナット" },
  ],
  巾木: [
    { name: "MDF巾木60H", code: "IN-BAS-MDF60", color: "ホワイト" },
    { name: "無垢材巾木", code: "IN-BAS-SOL", color: "ナチュラル" },
    { name: "アルミ見切(フラット)", code: "IN-BAS-ALF", color: "シルバー" },
  ],
  建具: [
    { name: "フラットドア(木製)", code: "IN-DR-FLT", color: "ホワイト" },
    { name: "引き戸(アルミ枠)", code: "IN-DR-SLD", color: "シルバー" },
    { name: "ガラス引き戸", code: "IN-DR-GLS", color: "クリア" },
    { name: "片開き(スチール)", code: "IN-DR-STL", color: "マットブラック" },
  ],
  備考: [],
};

// ── テンプレート ─────────────────────────────────────────────────────────────

function emptyCell(): CellValue {
  return { name: "", code: "", color: "" };
}

const TEMPLATES: Record<TemplateName, Record<RoomPart, CellValue>> = {
  ナチュラル系: {
    床材: { name: "オーク突板フローリング", code: "SF-OAK-15", color: "ナチュラルブラウン" },
    壁材: { name: "珪藻土塗り壁", code: "PT-KST-01", color: "アイボリー" },
    天井材: { name: "PB12.5 AEP仕上", code: "IN-CLG-AEP", color: "マットホワイト" },
    巾木: { name: "無垢材巾木", code: "IN-BAS-SOL", color: "ナチュラル" },
    建具: { name: "フラットドア(木製)", code: "IN-DR-FLT", color: "ホワイト" },
    備考: emptyCell(),
  },
  モノトーン系: {
    床材: { name: "コンクリート研磨", code: "SF-CON-PL", color: "グレー" },
    壁材: { name: "AEP塗装", code: "PT-AEP-WH", color: "マットホワイト" },
    天井材: { name: "PB12.5 AEP仕上", code: "IN-CLG-AEP", color: "マットホワイト" },
    巾木: { name: "アルミ見切(フラット)", code: "IN-BAS-ALF", color: "シルバー" },
    建具: { name: "片開き(スチール)", code: "IN-DR-STL", color: "マットブラック" },
    備考: emptyCell(),
  },
  和モダン系: {
    床材: { name: "畳(琉球)", code: "SF-TAT-RYU", color: "グリーン" },
    壁材: { name: "木板張り(ヒノキ)", code: "IN-WD-HNK", color: "ナチュラル" },
    天井材: { name: "木毛板", code: "IN-CLG-WW", color: "ナチュラル" },
    巾木: { name: "MDF巾木60H", code: "IN-BAS-MDF60", color: "ホワイト" },
    建具: { name: "引き戸(アルミ枠)", code: "IN-DR-SLD", color: "シルバー" },
    備考: emptyCell(),
  },
};

const TEMPLATE_NAMES: TemplateName[] = ["ナチュラル系", "モノトーン系", "和モダン系"];

// ── 初期行データ ─────────────────────────────────────────────────────────────

function defaultCell(): CellValue {
  return { name: "", code: "", color: "" };
}

function defaultRow(id: string, roomName: string): RowData {
  return {
    id,
    roomName,
    cells: {
      床材: defaultCell(),
      壁材: defaultCell(),
      天井材: defaultCell(),
      巾木: defaultCell(),
      建具: defaultCell(),
      備考: defaultCell(),
    },
  };
}

const DEFAULT_ROOMS = ["LDK", "寝室1", "寝室2", "トイレ", "洗面", "玄関"];

function buildInitialRows(): RowData[] {
  return DEFAULT_ROOMS.map((room, i) => defaultRow(`row-${i}`, room));
}

// ── CSV エクスポート ──────────────────────────────────────────────────────────

function exportCsv(rows: RowData[], projectName: string): void {
  const headers = ["部屋", ...PARTS.map((p) => `${p}_品名`), ...PARTS.map((p) => `${p}_品番`), ...PARTS.map((p) => `${p}_色`),];

  // 列順序: 部屋, 部位×(品名/品番/色) をまとめた形式に変更
  const orderedHeaders = ["部屋"];
  for (const part of PARTS) {
    orderedHeaders.push(`${part}_品名`, `${part}_品番`, `${part}_色`);
  }

  const csvRows = [
    orderedHeaders.join(","),
    ...rows.map((row) => {
      const cols = [row.roomName];
      for (const part of PARTS) {
        const c = row.cells[part];
        cols.push(
          `"${c.name.replace(/"/g, '""')}"`,
          `"${c.code.replace(/"/g, '""')}"`,
          `"${c.color.replace(/"/g, '""')}"`,
        );
      }
      return cols.join(",");
    }),
  ];

  // BOM付きUTF-8
  const bom = "\uFEFF";
  const content = bom + csvRows.join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `仕上表_${projectName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── セル編集コンポーネント ────────────────────────────────────────────────────

function CellEditor({
  part,
  value,
  onChange,
}: {
  part: RoomPart;
  value: CellValue;
  onChange: (v: CellValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const candidates = MATERIAL_CANDIDATES[part] ?? [];
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (c: MaterialCandidate) => {
    onChange({ name: c.name, code: c.code, color: c.color });
    setOpen(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  if (part === "備考") {
    return (
      <textarea
        data-testid={`cell-textarea-${part}`}
        rows={2}
        className="w-full resize-none rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[#7BA88A] focus:outline-none"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="備考"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        data-testid={`cell-button-${part}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-left focus:border-[#7BA88A] focus:outline-none"
      >
        {value.name ? (
          <span className="block space-y-0.5">
            <span className="block text-xs font-medium text-slate-800 leading-tight truncate">{value.name}</span>
            <span className="block text-[10px] text-slate-400 leading-tight truncate">{value.code}</span>
            <span className="block text-[10px] text-[#7BA88A] leading-tight truncate">{value.color}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </button>

      {open && candidates.length > 0 && (
        <div
          data-testid={`cell-dropdown-${part}`}
          className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-md"
        >
          {candidates.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors duration-[150ms] first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="block font-medium text-slate-800 truncate">{c.name}</span>
              <span className="block text-[10px] text-slate-400">{c.code} / {c.color}</span>
            </button>
          ))}
          <div className="border-t border-slate-100 px-3 py-1.5">
            <input
              autoFocus
              type="text"
              placeholder="品名を入力..."
              className="w-full text-xs text-slate-700 outline-none bg-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) onChange({ name: v, code: "", color: "" });
                  setOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

      {open && candidates.length === 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
          <input
            autoFocus
            type="text"
            placeholder="品名を入力..."
            className="w-full text-xs text-slate-700 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) onChange({ name: v, code: "", color: "" });
                setOpen(false);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── メインページ ─────────────────────────────────────────────────────────────

export interface FinishingScheduleProps {
  projectName?: string;
  siteAddress?: string;
  createdDate?: string;
}

export function FinishingSchedulePage({
  projectName = "施工案件",
  siteAddress = "",
  createdDate,
}: FinishingScheduleProps) {
  const [rows, setRows] = useState<RowData[]>(buildInitialRows);
  const [templateFading, setTemplateFading] = useState(false);
  const today = createdDate ?? new Date().toISOString().slice(0, 10);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      defaultRow(`row-${Date.now()}`, `部屋${prev.length + 1}`),
    ]);
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRoomName = useCallback((id: string, name: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, roomName: name } : r)),
    );
  }, []);

  const updateCell = useCallback((id: string, part: RoomPart, value: CellValue) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, cells: { ...r.cells, [part]: value } } : r,
      ),
    );
  }, []);

  const applyTemplate = useCallback((name: TemplateName) => {
    setTemplateFading(true);
    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          cells: { ...TEMPLATES[name] },
        })),
      );
      setTemplateFading(false);
    }, 75); // 半分の時間でフェードアウト → 合計150ms
  }, []);

  const handleExportCsv = useCallback(() => {
    exportCsv(rows, projectName);
  }, [rows, projectName]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const rowCount = rows.length;
  const filledCount = useMemo(
    () => rows.filter((r) => PARTS.some((p) => p !== "備考" && r.cells[p].name)).length,
    [rows],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 print:static print:border-none">
        <div className="mx-auto max-w-6xl flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">仕上表</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {projectName}
              {siteAddress && <span className="mx-1.5 text-slate-300">|</span>}
              {siteAddress}
              <span className="mx-1.5 text-slate-300">|</span>
              作成日 {today}
            </p>
          </div>

          {/* アクション (印刷時は非表示) */}
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs text-slate-400">{filledCount}/{rowCount}部屋入力済</span>
            <button
              type="button"
              data-testid="export-csv-button"
              onClick={handleExportCsv}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-[150ms] hover:bg-slate-50"
            >
              CSV出力
            </button>
            <button
              type="button"
              data-testid="print-button"
              onClick={handlePrint}
              className="rounded-lg bg-[#7BA88A] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-[150ms] hover:bg-[#5E8A6C]"
            >
              印刷
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* ── テンプレート選択 ── */}
        <section className="mb-5 print:hidden" aria-label="テンプレート">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">テンプレートを適用</p>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATE_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                data-testid={`template-${name}`}
                onClick={() => applyTemplate(name)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-[150ms] hover:border-[#7BA88A] hover:text-[#7BA88A]"
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {/* ── 仕上表 (横スクロール可) ── */}
        <div
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        >
          <table
            data-testid="finishing-table"
            className={`w-full min-w-[860px] border-collapse text-sm transition-opacity duration-[150ms] ${templateFading ? "opacity-0" : "opacity-100"}`}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-28 px-3 py-3 text-left text-xs font-semibold text-slate-600">部屋</th>
                {PARTS.map((part) => (
                  <th key={part} className="px-3 py-3 text-left text-xs font-semibold text-slate-600">
                    {part}
                  </th>
                ))}
                <th className="w-10 px-2 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  data-testid="finishing-row"
                  className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                >
                  {/* 部屋名 */}
                  <td className="px-3 py-2">
                    <input
                      data-testid={`room-name-${row.id}`}
                      type="text"
                      value={row.roomName}
                      onChange={(e) => updateRoomName(row.id, e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-[#7BA88A] focus:outline-none"
                    />
                  </td>

                  {/* 部位セル */}
                  {PARTS.map((part) => (
                    <td key={part} className="px-3 py-2 min-w-[120px]">
                      <CellEditor
                        part={part}
                        value={row.cells[part]}
                        onChange={(v) => updateCell(row.id, part, v)}
                      />
                    </td>
                  ))}

                  {/* 削除 */}
                  <td className="px-2 py-2 text-center print:hidden">
                    <button
                      type="button"
                      data-testid={`delete-row-${row.id}`}
                      onClick={() => deleteRow(row.id)}
                      aria-label={`${row.roomName}を削除`}
                      className="rounded p-1 text-slate-300 transition-colors duration-[150ms] hover:bg-red-50 hover:text-red-400"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 行追加 ── */}
        <button
          type="button"
          data-testid="add-row-button"
          onClick={addRow}
          className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 transition-colors duration-[150ms] hover:border-[#7BA88A] hover:text-[#7BA88A] print:hidden"
        >
          + 部屋を追加
        </button>
      </div>

      {/* ── 印刷スタイル ── */}
      <style>{`
        @media print {
          body { background: white; }
          @page { size: A4 landscape; margin: 15mm; }
          table { font-size: 10px; }
          th, td { padding: 4px 6px !important; }
          .print\\:hidden { display: none !important; }
          .print\\:static { position: static !important; }
          .print\\:border-none { border: none !important; }
        }
      `}</style>
    </div>
  );
}
