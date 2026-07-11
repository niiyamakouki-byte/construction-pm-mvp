import {
  createPhotoRepository,
  type AiPhotoClassification,
  type PhotoRepository,
  type PhotoUploadOptions,
  type UploadedPhoto,
} from "../infra/supabase-adapter/photo-repository.js";
import { E2E_PHOTOS_STORAGE_KEY } from "../lib/e2e-seed.js";

export type PhotoStore = {
  uploadPhoto(
    file: File,
    projectId: string,
    taskId?: string,
    options?: PhotoUploadOptions,
  ): Promise<UploadedPhoto>;
  listPhotosByProject(projectId: string): Promise<UploadedPhoto[]>;
  updatePhotoClassification(
    photoId: string,
    classification: AiPhotoClassification,
  ): Promise<UploadedPhoto>;
};

function createE2ELocalPhotoStore(): PhotoStore {
  const read = (): UploadedPhoto[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(E2E_PHOTOS_STORAGE_KEY) ?? "[]") as unknown;
      return Array.isArray(parsed) ? parsed as UploadedPhoto[] : [];
    } catch {
      return [];
    }
  };
  const write = (photos: UploadedPhoto[]) => localStorage.setItem(E2E_PHOTOS_STORAGE_KEY, JSON.stringify(photos));

  return {
    async uploadPhoto(file, projectId, taskId, options = {}) {
      const timestamp = new Date().toISOString();
      const photo: UploadedPhoto = {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        projectId,
        taskId,
        storagePath: `e2e/${file.name}`,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        category: options.category,
        caption: options.caption,
        takenAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      write([...read(), photo]);
      return photo;
    },
    async listPhotosByProject(projectId) {
      return read().filter((photo) => photo.projectId === projectId);
    },
    async updatePhotoClassification(photoId, classification) {
      const photos = read();
      const index = photos.findIndex((photo) => photo.id === photoId);
      if (index === -1) throw new Error("対象の写真が見つかりません");
      const updated = { ...photos[index]!, aiClassification: classification, updatedAt: new Date().toISOString() };
      photos[index] = updated;
      write(photos);
      return updated;
    },
  };
}

export function createPhotoStore(
  repository: PhotoRepository = createPhotoRepository(),
): PhotoStore {
  if (typeof window !== "undefined" && window.__E2E_BYPASS_AUTH__ === true) {
    return createE2ELocalPhotoStore();
  }
  return {
    uploadPhoto: repository.uploadPhoto.bind(repository),
    listPhotosByProject: repository.listPhotosByProject.bind(repository),
    updatePhotoClassification: repository.updatePhotoClassification.bind(repository),
  };
}
