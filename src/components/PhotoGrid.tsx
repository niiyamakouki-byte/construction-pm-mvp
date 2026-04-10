import type { PhotoMetadata } from "../lib/photo-organizer.js";
import { classifyPhoto } from "../lib/photo-classifier.js";

const CATEGORY_COLORS: Record<string, string> = {
  基礎工事: "bg-amber-100 text-amber-800",
  内装: "bg-blue-100 text-blue-800",
  外装: "bg-emerald-100 text-emerald-800",
  設備: "bg-purple-100 text-purple-800",
  完成: "bg-slate-100 text-slate-700",
};

function getCategoryColor(tag: string): string {
  return CATEGORY_COLORS[tag] ?? "bg-slate-100 text-slate-600";
}

type PhotoCardProps = {
  photo: PhotoMetadata;
};

function PhotoCard({ photo }: PhotoCardProps) {
  const isBefore = photo.tags.includes("before") || photo.tags.includes("着工前");
  const isAfter = photo.tags.includes("after") || photo.tags.includes("完成後");
  const categoryTag = photo.tags.find((t) => t !== "before" && t !== "after" && t !== "着工前" && t !== "完成後");

  // Auto-classify when no explicit before/after tag is present
  const classified = (!isBefore && !isAfter) ? classifyPhoto(photo.description) : null;
  const autoBeforeAfter = classified?.beforeAfter ?? null;
  const autoCategory = classified?.category ?? null;
  const showBefore = isBefore || autoBeforeAfter === "before";
  const showAfter = isAfter || autoBeforeAfter === "after";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-100">
        {photo.url ? (
          <img
            src={photo.url}
            alt={photo.description}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
        )}
        {(showBefore || showAfter) && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              showBefore ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
            }`}
          >
            {showBefore ? "Before" : "After"}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        {(categoryTag ?? autoCategory) && (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryColor(categoryTag ?? autoCategory ?? "")}`}>
            {categoryTag ?? autoCategory}
          </span>
        )}
        <p className="mt-1 truncate text-sm font-medium text-slate-800">{photo.description}</p>
        <p className="text-xs text-slate-400">{photo.capturedAt.slice(0, 10)}</p>
      </div>
    </div>
  );
}

type Props = {
  photos: PhotoMetadata[];
  emptyMessage?: string;
};

export function PhotoGrid({ photos, emptyMessage = "写真がありません" }: Props) {
  if (photos.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
