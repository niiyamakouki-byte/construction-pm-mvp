import { useState, useRef, useCallback } from "react";
import {
  createPin,
  updatePin,
  deletePin,
  PIN_STATUS_COLORS,
  PIN_STATUSES,
  type DrawingPin,
  type PinStatus,
} from "../lib/drawing-pins.js";

type Props = {
  /** Drawing image URL */
  drawingUrl: string;
  /** Initial pins (controlled or uncontrolled) */
  initialPins?: DrawingPin[];
  /** Called whenever pins change */
  onPinsChange?: (pins: DrawingPin[]) => void;
};

type PopoverState = {
  pinId: string;
  editing: boolean;
};

export function DrawingViewer({ drawingUrl, initialPins = [], onPinsChange }: Props) {
  const [pins, setPins] = useState<DrawingPin[]>(initialPins);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [draft, setDraft] = useState<Partial<DrawingPin>>({});
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const notify = (next: DrawingPin[]) => {
    setPins(next);
    onPinsChange?.(next);
  };

  const getRelativePos = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const handleImageClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!addMode) return;
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      const pos = getRelativePos(clientX, clientY);
      if (!pos) return;
      setDraft({ x: pos.x, y: pos.y, status: "未着手", comment: "", assignee: "", dueDate: "" });
      setPopover({ pinId: "__new__", editing: true });
      setAddMode(false);
    },
    [addMode, getRelativePos]
  );

  const handleSaveDraft = () => {
    if (draft.x == null || draft.y == null) return;
    const pin = createPin({
      x: draft.x,
      y: draft.y,
      comment: draft.comment ?? "",
      assignee: draft.assignee ?? "",
      dueDate: draft.dueDate ?? "",
      status: (draft.status as PinStatus) ?? "未着手",
    });
    notify([...pins, pin]);
    setPopover(null);
    setDraft({});
  };

  const handleUpdatePin = (id: string, updates: Partial<DrawingPin>) => {
    notify(updatePin(pins, id, updates));
  };

  const handleDeletePin = (id: string) => {
    notify(deletePin(pins, id));
    setPopover(null);
  };

  const activePin = popover?.pinId !== "__new__" ? pins.find((p) => p.id === popover?.pinId) : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row" ref={containerRef}>
      {/* Drawing canvas area */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 select-none">
        <img
          ref={imgRef}
          src={drawingUrl}
          alt="図面"
          className={`w-full ${addMode ? "cursor-crosshair" : "cursor-default"}`}
          onClick={handleImageClick}
          onTouchStart={handleImageClick}
          draggable={false}
        />

        {/* Pin markers */}
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              backgroundColor: PIN_STATUS_COLORS[pin.status],
            }}
            className="absolute -translate-x-1/2 -translate-y-full rounded-full w-7 h-7 flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white hover:scale-110 transition-transform z-10"
            onClick={(e) => {
              e.stopPropagation();
              setPopover({ pinId: pin.id, editing: false });
              setDraft({});
            }}
            aria-label={`ピン: ${pin.comment || pin.assignee || pin.status}`}
          >
            📌
          </button>
        ))}

        {/* Add mode indicator */}
        {addMode && (
          <div className="absolute inset-0 border-2 border-blue-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow">
              タップしてピンを配置
            </span>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col gap-3 lg:w-72">
        <button
          type="button"
          onClick={() => { setAddMode((v) => !v); setPopover(null); }}
          className={`rounded-2xl py-3 text-sm font-bold transition-colors ${
            addMode
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {addMode ? "配置モード ON — キャンセル" : "＋ ピン追加"}
        </button>

        {/* Pin list */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
          {pins.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">ピンがありません</p>
          )}
          {pins.map((pin, idx) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => setPopover({ pinId: pin.id, editing: false })}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:bg-slate-50 transition-colors"
            >
              <span
                className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: PIN_STATUS_COLORS[pin.status] }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-700">
                  #{idx + 1} {pin.comment || "(コメントなし)"}
                </p>
                <p className="text-xs text-slate-400">
                  {pin.assignee} {pin.dueDate ? `· ${pin.dueDate}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: PIN_STATUS_COLORS[pin.status] }}>
                {pin.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setPopover(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {popover.pinId === "__new__" ? (
              <NewPinForm
                draft={draft}
                onChange={setDraft}
                onSave={handleSaveDraft}
                onCancel={() => setPopover(null)}
              />
            ) : activePin ? (
              <PinDetail
                pin={activePin}
                editing={popover.editing}
                onEdit={() => setPopover({ pinId: activePin.id, editing: true })}
                onChange={(updates) => handleUpdatePin(activePin.id, updates)}
                onDelete={() => handleDeletePin(activePin.id)}
                onClose={() => setPopover(null)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

type NewPinFormProps = {
  draft: Partial<DrawingPin>;
  onChange: (d: Partial<DrawingPin>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function NewPinForm({ draft, onChange, onSave, onCancel }: NewPinFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold text-slate-800">ピンを追加</h3>
      <PinFields pin={draft} onChange={onChange} />
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="flex-1 rounded-2xl bg-slate-800 py-2.5 text-sm font-bold text-white">
          追加
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600">
          キャンセル
        </button>
      </div>
    </div>
  );
}

type PinDetailProps = {
  pin: DrawingPin;
  editing: boolean;
  onEdit: () => void;
  onChange: (updates: Partial<DrawingPin>) => void;
  onDelete: () => void;
  onClose: () => void;
};

function PinDetail({ pin, editing, onEdit, onChange, onDelete, onClose }: PinDetailProps) {
  const [local, setLocal] = useState<Partial<DrawingPin>>(pin);

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-slate-800">ピンを編集</h3>
        <PinFields pin={local} onChange={(u) => setLocal((p) => ({ ...p, ...u }))} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onChange(local); onClose(); }}
            className="flex-1 rounded-2xl bg-slate-800 py-2.5 text-sm font-bold text-white"
          >
            保存
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600">
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">ピン詳細</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
        <p><span className="font-semibold">コメント:</span> {pin.comment || "—"}</p>
        <p><span className="font-semibold">担当者:</span> {pin.assignee || "—"}</p>
        <p><span className="font-semibold">期日:</span> {pin.dueDate || "—"}</p>
        <p>
          <span className="font-semibold">ステータス:</span>{" "}
          <span className="font-bold" style={{ color: PIN_STATUS_COLORS[pin.status] }}>{pin.status}</span>
        </p>
      </div>
      {/* Quick status change */}
      <div className="flex gap-2">
        {PIN_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ status: s })}
            className="flex-1 rounded-full py-1.5 text-xs font-bold text-white transition-opacity"
            style={{
              backgroundColor: PIN_STATUS_COLORS[s],
              opacity: pin.status === s ? 1 : 0.4,
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          編集
        </button>
        <button type="button" onClick={onDelete} className="flex-1 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white">
          削除
        </button>
      </div>
    </div>
  );
}

type PinFieldsProps = {
  pin: Partial<DrawingPin>;
  onChange: (updates: Partial<DrawingPin>) => void;
};

function PinFields({ pin, onChange }: PinFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        コメント
        <input
          type="text"
          value={pin.comment ?? ""}
          onChange={(e) => onChange({ comment: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
          placeholder="指摘内容など"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        担当者
        <input
          type="text"
          value={pin.assignee ?? ""}
          onChange={(e) => onChange({ assignee: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
          placeholder="氏名"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        期日
        <input
          type="date"
          value={pin.dueDate ?? ""}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        ステータス
        <div className="flex gap-2">
          {PIN_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ status: s })}
              className="flex-1 rounded-full py-1.5 text-xs font-bold text-white transition-opacity"
              style={{
                backgroundColor: PIN_STATUS_COLORS[s],
                opacity: pin.status === s ? 1 : 0.35,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
