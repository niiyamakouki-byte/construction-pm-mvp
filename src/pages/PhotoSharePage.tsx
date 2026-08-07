/** laporta-beads-yf4or — Codex implementation, 2026-08-07; commit 881e1661e67e8bcf050cf75c884e8bd741a1013b. */
import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { PhotoGrid } from "../components/PhotoGrid.js";
import { readPhotoShare, type PhotoShareGallery } from "../lib/photo-share.js";
import type { PhotoMetadata } from "../lib/photo-organizer.js";

function toMetadata(photo: PhotoShareGallery["photos"][number], projectId: string): PhotoMetadata {
  return {
    id: photo.id,
    url: photo.url,
    projectId,
    capturedAt: photo.takenAt,
    description: photo.caption || photo.fileName,
    tags: photo.category ? [photo.category] : [],
  };
}

export function PhotoSharePage({ token }: { token: string }) {
  const [gallery, setGallery] = useState<PhotoShareGallery | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readPhotoShare(token)
      .then((result) => {
        if (!cancelled) setGallery(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "共有写真を取得できませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F8F4] p-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Camera className="mx-auto text-[#6B8E5A]" size={28} aria-hidden="true" />
          <h1 className="mt-4 text-lg font-bold text-slate-800">写真を表示できません</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <p className="mt-1 text-xs text-slate-400">担当者に新しい共有リンクをご依頼ください。</p>
        </section>
      </main>
    );
  }

  if (!gallery) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F6F8F4] text-sm text-slate-500">写真を読み込んでいます...</main>;
  }

  const photos = gallery.photos.map((photo) => toMetadata(photo, gallery.projectId));
  return (
    <main className="min-h-screen bg-[#F6F8F4] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 border-b border-[#DDE5D8] pb-5">
          <p className="text-xs font-semibold tracking-wide text-[#6B8E5A]">現場写真共有</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{gallery.projectName}</h1>
          <p className="mt-2 text-sm text-slate-500">現場から共有された最新の写真です。</p>
        </header>
        <PhotoGrid photos={photos} emptyMessage="共有された写真はまだありません" />
      </div>
    </main>
  );
}
