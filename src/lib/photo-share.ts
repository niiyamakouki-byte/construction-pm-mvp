/** laporta-beads-yf4or — Codex implementation, 2026-08-07; commit 881e1661e67e8bcf050cf75c884e8bd741a1013b. */
export type PhotoShareFetcher = (url: string, init: RequestInit) => Promise<Response>;

export type SharedPhoto = {
  id: string;
  url: string;
  fileName: string;
  category: string | null;
  caption: string | null;
  takenAt: string;
};

export type PhotoShareGallery = {
  projectId: string;
  projectName: string;
  expiresAt: string;
  photos: SharedPhoto[];
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error ?? fallback);
}

export async function createPhotoShare(
  projectId: string,
  expiresInDays: number,
  accessToken: string,
  fetcher: PhotoShareFetcher = fetch.bind(globalThis),
): Promise<{ token: string; expiresAt: string }> {
  const response = await fetcher("/api/photo-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: "create", projectId, expiresInDays }),
  });
  if (!response.ok) throw await responseError(response, "共有リンクの発行に失敗しました");
  return response.json() as Promise<{ token: string; expiresAt: string }>;
}

export async function readPhotoShare(
  token: string,
  fetcher: PhotoShareFetcher = fetch.bind(globalThis),
): Promise<PhotoShareGallery> {
  const response = await fetcher("/api/photo-share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read", token }),
  });
  if (!response.ok) throw await responseError(response, "共有写真の取得に失敗しました");
  return response.json() as Promise<PhotoShareGallery>;
}
