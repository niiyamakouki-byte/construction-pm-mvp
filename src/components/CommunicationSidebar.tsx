/**
 * Stock/Flow コミュニケーションサイドバー
 * - Stock (上部): 図面・資料の固定エリア
 * - Flow (下部): タイムラインチャット（ProjectChatで実データ管理）
 */

import { ProjectChat } from "./ProjectChat.js";

type StockItem = {
  id: string;
  name: string;
  type: string;
  thumbnailBg: string;
};


const MOCK_STOCK_ITEMS: StockItem[] = [
  { id: "1", name: "1F平面図_v3.pdf", type: "PDF", thumbnailBg: "#dbeafe" },
  { id: "2", name: "電気配線図.dwg", type: "CAD", thumbnailBg: "#dcfce7" },
  { id: "3", name: "仕上げ表_最終.xlsx", type: "Excel", thumbnailBg: "#fef9c3" },
  { id: "4", name: "外観パース.png", type: "画像", thumbnailBg: "#fce7f3" },
];


type Props = {
  open: boolean;
  onClose: () => void;
  projectId?: string;
};

function FileIcon({ type }: { type: string }) {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold text-slate-600 bg-white/70 border border-slate-200">
      {type.slice(0, 3)}
    </div>
  );
}

export function CommunicationSidebar({ open, onClose, projectId }: Props) {
  if (!open) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        className={`
          fixed right-0 top-0 z-40 flex h-full flex-col bg-white shadow-2xl
          w-full sm:w-[380px]
          border-l border-slate-200
        `}
        role="complementary"
        aria-label="コミュニケーションパネル"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">現場コミュニケーション</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stock section */}
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              図面・資料（Stock）
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOCK_STOCK_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-2 text-center hover:bg-slate-50 hover:border-slate-300 transition-colors group"
              >
                <div
                  className="flex h-14 w-full items-center justify-center rounded-md relative"
                  style={{ backgroundColor: item.thumbnailBg }}
                >
                  <FileIcon type={item.type} />
                  <span className="absolute bottom-1 right-1 rounded text-[9px] font-semibold text-slate-500 bg-white/80 px-1">
                    {item.type}
                  </span>
                </div>
                <span className="w-full truncate text-[10px] text-slate-600 group-hover:text-slate-900 transition-colors">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Flow section */}
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              チャット（Flow）
            </span>
          </div>
          {projectId ? (
            <ProjectChat projectId={projectId} />
          ) : (
            <p className="px-4 py-3 text-xs text-slate-400">
              プロジェクトを選択するとチャットが利用できます。
            </p>
          )}
        </div>
      </div>
    </>
  );
}
