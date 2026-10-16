import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { DB_NAME, STORES, closeDb, openDb } from "@/lib/storage/db";
import { deletePhoto, listPhotos, savePhoto, updateCaption, type StoredPhoto } from "@/lib/storage/photos";
import { listLibrary } from "@/lib/storage/library";
import { PhotoInputError, fitWithin, validatePhotoFile } from "@/lib/photos/process";

async function deleteDb() {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function photo(id: string, createdAt: string): StoredPhoto {
  return { id, name: id, type: "image/jpeg", data: new Uint8Array([1, 2, 3]).buffer, width: 10, height: 20, caption: "", createdAt };
}

describe("photo gallery storage", () => {
  beforeEach(deleteDb);

  it("saves, lists newest first, captions, persists and deletes photos", async () => {
    await savePhoto(photo("a", "2026-01-01T00:00:00Z"));
    await savePhoto(photo("b", "2026-02-01T00:00:00Z"));
    await updateCaption("a", "  Sunset by the sea  ");
    await closeDb(); // simulate a refresh
    const photos = await listPhotos();
    expect(photos.map((p) => p.id)).toEqual(["b", "a"]);
    expect(photos[1]?.caption).toBe("Sunset by the sea");
    expect(new Uint8Array(photos[1]!.data)).toEqual(new Uint8Array([1, 2, 3]));
    await deletePhoto("a");
    expect((await listPhotos()).map((p) => p.id)).toEqual(["b"]);
    await expect(updateCaption("a", "x")).rejects.toThrow(/no longer exists/);
  });

  it("caps caption length", async () => {
    await savePhoto(photo("c", "2026-01-01T00:00:00Z"));
    expect((await updateCaption("c", "x".repeat(500))).caption).toHaveLength(300);
  });

  it("upgrades an existing v1 database without losing library data", async () => {
    // Create a v1 database the way the previous app version did, with one saved paper.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore(STORES.library, { keyPath: "paper.id" }).put({
          paper: { id: "openalex:W1", title: "Old paper" },
          status: "reading",
          tags: [],
          notes: "keep me",
          documentId: null,
          addedAt: "1",
          updatedAt: "1",
        });
        db.createObjectStore(STORES.documents, { keyPath: "id" });
        db.createObjectStore(STORES.study, { keyPath: "id" });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    const db = await openDb();
    expect(db.version).toBe(2);
    expect(db.objectStoreNames.contains(STORES.photos)).toBe(true);
    const [entry] = await listLibrary();
    expect(entry?.notes).toBe("keep me");
  });
});

describe("photo processing helpers", () => {
  it("fits large images within the max side and never upscales", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
    expect(() => fitWithin(0, 10)).toThrow(PhotoInputError);
  });

  it("validates file type and size", () => {
    expect(() => validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: 100 })).not.toThrow();
    expect(() => validatePhotoFile({ name: "IMG_1.HEIC", type: "", size: 100 })).not.toThrow();
    expect(() => validatePhotoFile({ name: "notes.pdf", type: "application/pdf", size: 100 })).toThrow(/not an image/);
    expect(() => validatePhotoFile({ name: "a.png", type: "image/png", size: 0 })).toThrow(/empty/);
    expect(() => validatePhotoFile({ name: "a.png", type: "image/png", size: 41 * 1024 * 1024 })).toThrow(/larger than/);
  });
});
