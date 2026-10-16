import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from "@/lib/storage/db";

/** A photo kept only in this browser. `data` holds re-encoded JPEG bytes (no EXIF/GPS). */
export interface StoredPhoto {
  id: string;
  name: string;
  type: string;
  data: ArrayBuffer;
  width: number;
  height: number;
  caption: string;
  createdAt: string;
}

export const MAX_CAPTION_CHARS = 300;

export async function listPhotos(): Promise<StoredPhoto[]> {
  const photos = await dbGetAll<StoredPhoto>(STORES.photos);
  return photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  await dbPut(STORES.photos, { ...photo, caption: photo.caption.slice(0, MAX_CAPTION_CHARS) });
}

export async function updateCaption(id: string, caption: string): Promise<StoredPhoto> {
  const photo = await dbGet<StoredPhoto>(STORES.photos, id);
  if (!photo) throw new Error("This photo no longer exists.");
  const updated = { ...photo, caption: caption.trim().slice(0, MAX_CAPTION_CHARS) };
  await dbPut(STORES.photos, updated);
  return updated;
}

export function deletePhoto(id: string): Promise<void> {
  return dbDelete(STORES.photos, id);
}
