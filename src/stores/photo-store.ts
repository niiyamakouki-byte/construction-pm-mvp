import {
  createPhotoRepository,
  type AiPhotoClassification,
  type PhotoRepository,
  type PhotoUploadOptions,
  type UploadedPhoto,
} from "../infra/supabase-adapter/photo-repository.js";

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

export function createPhotoStore(
  repository: PhotoRepository = createPhotoRepository(),
): PhotoStore {
  return {
    uploadPhoto: repository.uploadPhoto.bind(repository),
    listPhotosByProject: repository.listPhotosByProject.bind(repository),
    updatePhotoClassification: repository.updatePhotoClassification.bind(repository),
  };
}
