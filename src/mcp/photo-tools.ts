import { classifyInteriorPhoto } from "../lib/interior-photo-classifier.js";
import { PhotoRepository, type PhotoRecord } from "../lib/supabase-adapter/PhotoRepository.js";

export type PhotoWithTags = PhotoRecord & {
  tags: string[];
};

const photoRepository = new PhotoRepository();
const photoTags = new Map<string, string[]>();

function withTags(photo: PhotoRecord): PhotoWithTags {
  return { ...photo, tags: photoTags.get(photo.id) ?? [] };
}

export async function classifyPhoto(input: { photo_url?: string; photo_id?: string }) {
  const filename = input.photo_url ?? (input.photo_id ? (await photoRepository.getAsync(input.photo_id))?.fileName : undefined);
  if (!filename) {
    throw new Error("photo_url or an existing photo_id is required");
  }

  return classifyInteriorPhoto(filename);
}

export async function listPhotos(input: { project_id?: string; tag?: string } = {}): Promise<PhotoWithTags[]> {
  const photos = input.project_id
    ? await photoRepository.listByProjectAsync(input.project_id)
    : await photoRepository.listAsync();
  const tagged = photos.map(withTags);
  return input.tag ? tagged.filter((photo) => photo.tags.includes(input.tag!)) : tagged;
}

export async function tagPhoto(input: { photo_id: string; tags: string[] }): Promise<PhotoWithTags> {
  const photo = await photoRepository.getAsync(input.photo_id);
  if (!photo) {
    throw new Error(`Photo ${input.photo_id} not found`);
  }

  const tags = Array.from(new Set(input.tags.filter(Boolean)));
  photoTags.set(input.photo_id, tags);
  return withTags(photo);
}

export async function savePhotoForMcp(photo: PhotoRecord): Promise<PhotoRecord> {
  await photoRepository.saveAsync(photo);
  return photo;
}
